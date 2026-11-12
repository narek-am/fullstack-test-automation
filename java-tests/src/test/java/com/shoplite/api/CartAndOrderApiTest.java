package com.shoplite.api;

import com.shoplite.api.model.Cart;
import com.shoplite.api.model.Order;
import com.shoplite.api.model.Product;
import com.shoplite.support.TestUsers;
import io.restassured.specification.RequestSpecification;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;

@DisplayName("Cart and order API")
class CartAndOrderApiTest extends BaseApiTest {

    private static final int MUG_ID = 3;

    private RequestSpecification alice;

    @BeforeEach
    void emptyAlicesCart() {
        alice = as(TestUsers.ALICE);
        Cart cart = given(alice).get("/api/cart").then().statusCode(200).extract().as(Cart.class);
        cart.items().forEach(line -> given(alice).delete("/api/cart/items/" + line.productId()));
    }

    private Cart addToCart(int productId, int quantity) {
        return given(alice)
                .body(Map.of("productId", productId, "quantity", quantity))
                .when().post("/api/cart/items")
                .then().statusCode(201)
                .extract().as(Cart.class);
    }

    private int stockOf(int productId) {
        return given(spec).get("/api/products/" + productId).then().extract().as(Product.class).stock();
    }

    @Test
    @DisplayName("cart totals follow the pricing rules")
    void cartTotals() {
        Cart cart = addToCart(MUG_ID, 2);

        assertThat(cart.items()).singleElement()
                .satisfies(line -> assertThat(line.quantity()).isEqualTo(2));
        int expectedSubtotal = cart.items().get(0).unitPriceCents() * 2;
        assertThat(cart.subtotalCents()).isEqualTo(expectedSubtotal);
        assertThat(cart.totalCents()).isEqualTo(cart.subtotalCents() + cart.shippingCents());
    }

    @Test
    @DisplayName("cannot add more than the available stock")
    void stockLimit() {
        int stock = stockOf(5);
        given(alice)
                .body(Map.of("productId", 5, "quantity", stock + 1))
                .when().post("/api/cart/items")
                .then().statusCode(409)
                .body("available", equalTo(stock));
    }

    @Test
    @DisplayName("placing an order reduces stock and empties the cart")
    void placeOrder() {
        int stockBefore = stockOf(MUG_ID);
        Cart cart = addToCart(MUG_ID, 1);

        Order order = given(alice)
                .when().post("/api/orders")
                .then().statusCode(201)
                .extract().as(Order.class);

        assertThat(order.status()).isEqualTo("PLACED");
        assertThat(order.totalCents()).isEqualTo(cart.totalCents());
        assertThat(order.items()).extracting(Order.Item::productId).containsExactly(MUG_ID);
        assertThat(stockOf(MUG_ID)).isEqualTo(stockBefore - 1);
        given(alice).get("/api/cart").then().body("items.size()", equalTo(0));
    }

    @Test
    @DisplayName("another customer cannot read the order (IDOR protection)")
    void otherUserCannotReadOrder() {
        addToCart(MUG_ID, 1);
        int orderId = given(alice).post("/api/orders").then().statusCode(201).extract().path("id");

        given(alice).get("/api/orders/" + orderId).then().statusCode(200);
        as(TestUsers.BOB).get("/api/orders/" + orderId).then().statusCode(404);
        as(TestUsers.ADMIN).get("/api/orders/" + orderId).then().statusCode(200);
    }

    @Test
    @DisplayName("checkout of an empty cart is rejected")
    void emptyCartCheckout() {
        given(alice).post("/api/orders").then().statusCode(400);
    }
}
