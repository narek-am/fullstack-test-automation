package com.shoplite.api;

import com.shoplite.api.model.LoginRequest;
import com.shoplite.api.model.LoginResponse;
import com.shoplite.support.ShopLiteServer;
import com.shoplite.support.TestUsers;
import io.restassured.RestAssured;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.builder.ResponseSpecBuilder;
import io.restassured.filter.log.LogDetail;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import io.restassured.specification.ResponseSpecification;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.lessThan;

@Tag("api")
abstract class BaseApiTest {

    protected static RequestSpecification spec;
    protected static ResponseSpecification fastJson;

    @BeforeAll
    static void configureRestAssured() {
        spec = new RequestSpecBuilder()
                .setBaseUri(ShopLiteServer.baseUrl())
                .setContentType(ContentType.JSON)
                .setAccept(ContentType.JSON)
                .build();
        fastJson = new ResponseSpecBuilder()
                .expectContentType(ContentType.JSON)
                .expectResponseTime(lessThan(2000L))
                .build();
        // Print request and response only when a test fails, keeps CI logs readable.
        RestAssured.enableLoggingOfRequestAndResponseIfValidationFails(LogDetail.ALL);
    }

    protected static String tokenFor(TestUsers user) {
        return given(spec)
                .body(new LoginRequest(user.email, user.password))
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .extract().as(LoginResponse.class)
                .token();
    }

    protected static RequestSpecification as(TestUsers user) {
        return given(spec).auth().oauth2(tokenFor(user));
    }
}
