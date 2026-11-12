package com.shoplite.data;

import com.shoplite.support.ShopLiteServer;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Acts through the public API, then reads the database directly over JDBC to check that
 * what the API reported is what was actually stored.
 */
@Tag("data")
@DisplayName("Order persistence (API + JDBC)")
class OrderPersistenceJdbcTest {

    private static final String EMAIL = "bob@shoplite.test";
    private static final String PASSWORD = "Passw0rd!";

    private static Connection connection;
    private static RequestSpecification spec;
    private String token;

    @BeforeAll
    static void connect() throws SQLException {
        assumeTrue(ShopLiteServer.dbPath().isPresent(),
                "JDBC checks need the local database; skipped for an external -Dshoplite.baseUrl");
        Path db = ShopLiteServer.dbPath().orElseThrow();
        // Read-only: the tests must never change data behind the app's back.
        var props = new java.util.Properties();
        props.setProperty("open_mode", "1"); // SQLITE_OPEN_READONLY
        connection = DriverManager.getConnection("jdbc:sqlite:" + db, props);
        spec = new RequestSpecBuilder().setBaseUri(ShopLiteServer.baseUrl()).setContentType(ContentType.JSON).build();
    }

    @AfterAll
    static void disconnect() throws SQLException {
        if (connection != null) {
            connection.close();
        }
    }

    @BeforeEach
    void loginAndEmptyCart() {
        token = given(spec).body(Map.of("email", EMAIL, "password", PASSWORD))
                .post("/api/auth/login").then().statusCode(200).extract().path("token");
        List<Integer> ids = given(spec).auth().oauth2(token).get("/api/cart")
                .then().extract().path("items.productId");
        ids.forEach(id -> given(spec).auth().oauth2(token).delete("/api/cart/items/" + id));
    }

    private int queryInt(String sql, Object... params) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                ps.setObject(i + 1, params[i]);
            }
            try (ResultSet rs = ps.executeQuery()) {
                assertThat(rs.next()).as("query returned a row: %s", sql).isTrue();
                return rs.getInt(1);
            }
        }
    }

    @Test
    @DisplayName("a placed order is stored with its lines, total and owner")
    void orderIsStored() throws SQLException {
        given(spec).auth().oauth2(token).body(Map.of("productId", 2, "quantity", 1)).post("/api/cart/items")
                .then().statusCode(201);
        given(spec).auth().oauth2(token).body(Map.of("productId", 3, "quantity", 2)).post("/api/cart/items")
                .then().statusCode(201);
        var order = given(spec).auth().oauth2(token).post("/api/orders")
                .then().statusCode(201).extract().jsonPath();
        int orderId = order.getInt("id");

        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT o.status, o.total_cents, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?")) {
            ps.setInt(1, orderId);
            try (ResultSet rs = ps.executeQuery()) {
                assertThat(rs.next()).isTrue();
                assertThat(rs.getString("status")).isEqualTo("PLACED");
                assertThat(rs.getInt("total_cents")).isEqualTo(order.getInt("totalCents"));
                assertThat(rs.getString("email")).isEqualTo(EMAIL);
            }
        }

        List<int[]> lines = new ArrayList<>();
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT product_id, quantity, unit_price_cents FROM order_items WHERE order_id = ? ORDER BY product_id")) {
            ps.setInt(1, orderId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    lines.add(new int[] {rs.getInt(1), rs.getInt(2), rs.getInt(3)});
                }
            }
        }
        assertThat(lines).extracting(l -> l[0]).containsExactly(2, 3);
        assertThat(lines).extracting(l -> l[1]).containsExactly(1, 2);
        int subtotal = lines.stream().mapToInt(l -> l[1] * l[2]).sum();
        assertThat(order.getInt("totalCents")).isEqualTo(subtotal + (subtotal >= 5000 ? 0 : 499));
    }

    @Test
    @DisplayName("checkout decrements stock in the products table and clears the cart rows")
    void stockAndCartUpdated() throws SQLException {
        int stockBefore = queryInt("SELECT stock FROM products WHERE id = ?", 1);
        given(spec).auth().oauth2(token).body(Map.of("productId", 1, "quantity", 3)).post("/api/cart/items")
                .then().statusCode(201);
        assertThat(queryInt("SELECT quantity FROM cart_items c JOIN users u ON u.id = c.user_id "
                + "WHERE u.email = ? AND c.product_id = 1", EMAIL)).isEqualTo(3);

        given(spec).auth().oauth2(token).post("/api/orders").then().statusCode(201);

        assertThat(queryInt("SELECT stock FROM products WHERE id = ?", 1)).isEqualTo(stockBefore - 3);
        assertThat(queryInt("SELECT COUNT(*) FROM cart_items c JOIN users u ON u.id = c.user_id WHERE u.email = ?",
                EMAIL)).isZero();
    }

    @Test
    @DisplayName("a rejected checkout leaves no partial order behind")
    void failedCheckoutIsRolledBack() throws SQLException {
        int ordersBefore = queryInt("SELECT COUNT(*) FROM orders");
        given(spec).auth().oauth2(token).post("/api/orders").then().statusCode(400); // empty cart
        assertThat(queryInt("SELECT COUNT(*) FROM orders")).isEqualTo(ordersBefore);
        assertThat(queryInt("SELECT COUNT(*) FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id "
                + "WHERE oi.order_id IS NULL")).isZero();
    }

    @Test
    @DisplayName("passwords are stored hashed, never in plain text")
    void passwordsHashed() throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement("SELECT password_hash FROM users WHERE email = ?")) {
            ps.setString(1, EMAIL);
            try (ResultSet rs = ps.executeQuery()) {
                assertThat(rs.next()).isTrue();
                String stored = rs.getString(1);
                assertThat(stored).doesNotContain(PASSWORD).matches("[0-9a-f]{32}:[0-9a-f]{64}");
            }
        }
    }

    @Test
    @DisplayName("the read-only connection cannot change data")
    void connectionIsReadOnly() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> {
            try (PreparedStatement ps = connection.prepareStatement("UPDATE products SET stock = 0")) {
                ps.executeUpdate();
            }
        }).isInstanceOf(SQLException.class).hasMessageContaining("readonly");
    }
}
