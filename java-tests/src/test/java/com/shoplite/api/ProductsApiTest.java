package com.shoplite.api;

import com.shoplite.api.model.Product;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Comparator;
import java.util.List;

import static io.restassured.RestAssured.given;
import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;

@DisplayName("Products API")
class ProductsApiTest extends BaseApiTest {

    @Test
    @DisplayName("product list matches the JSON schema contract")
    void productListMatchesSchema() {
        given(spec)
                .when().get("/api/products")
                .then().spec(fastJson)
                .statusCode(200)
                .body(matchesJsonSchemaInClasspath("schemas/product-list.json"));
    }

    @Test
    @DisplayName("total equals the number of returned items")
    void totalMatchesItems() {
        given(spec)
                .when().get("/api/products")
                .then().statusCode(200)
                .body("total", equalTo(6))
                .body("items", hasSize(6));
    }

    @Test
    @DisplayName("product details deserialize into a typed model")
    void getProductById() {
        Product product = given(spec)
                .pathParam("id", 1)
                .when().get("/api/products/{id}")
                .then().statusCode(200)
                .extract().as(Product.class);

        assertThat(product.sku()).isEqualTo("BK-001");
        assertThat(product.priceCents()).isPositive();
        assertThat(product.inStock()).isEqualTo(product.stock() > 0);
    }

    @Test
    @DisplayName("search is case-insensitive and only returns matches")
    void searchProducts() {
        given(spec)
                .queryParam("search", "KEYBOARD")
                .when().get("/api/products")
                .then().statusCode(200)
                .body("items.sku", equalTo(List.of("KB-001")));
    }

    @Test
    @DisplayName("category filter returns only that category")
    void filterByCategory() {
        given(spec)
                .queryParam("category", "books")
                .when().get("/api/products")
                .then().statusCode(200)
                .body("items.category", everyItem(is("books")));
    }

    @ParameterizedTest(name = "sort={0}")
    @ValueSource(strings = {"price_asc", "price_desc"})
    @DisplayName("sorting by price orders the items")
    void sortByPrice(String sort) {
        List<Product> items = given(spec)
                .queryParam("sort", sort)
                .when().get("/api/products")
                .then().statusCode(200)
                .extract().jsonPath().getList("items", Product.class);

        Comparator<Product> byPrice = Comparator.comparingInt(Product::priceCents);
        assertThat(items).isSortedAccordingTo(sort.equals("price_asc") ? byPrice : byPrice.reversed());
    }

    @ParameterizedTest(name = "GET {0} -> {1}")
    @CsvSource({
            "/api/products/99999,       404",
            "/api/products/abc,         400",
            "/api/products/-1,          400",
            "/api/products?sort=random, 400",
    })
    @DisplayName("invalid requests get the right error status")
    void errorCases(String path, int status) {
        given(spec)
                .urlEncodingEnabled(false)
                .when().get(path)
                .then().statusCode(status)
                .body("error", org.hamcrest.Matchers.not(org.hamcrest.Matchers.emptyOrNullString()));
    }
}
