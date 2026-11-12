package com.shoplite.api;

import com.shoplite.api.model.LoginRequest;
import com.shoplite.api.model.LoginResponse;
import com.shoplite.support.TestUsers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.Map;
import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.hasKey;

@DisplayName("Auth API")
class AuthApiTest extends BaseApiTest {

    @Test
    @DisplayName("valid credentials return a token and a safe user profile")
    void loginSucceeds() {
        LoginResponse response = given(spec)
                .body(new LoginRequest(TestUsers.ALICE.email, TestUsers.ALICE.password))
                .when().post("/api/auth/login")
                .then().spec(fastJson).statusCode(200)
                .body("user", not(hasKey("password_hash")))
                .extract().as(LoginResponse.class);

        assertThat(response.token()).isNotBlank();
        assertThat(response.user().email()).isEqualTo(TestUsers.ALICE.email);
        assertThat(response.user().role()).isEqualTo("customer");
    }

    @Test
    @DisplayName("wrong password and unknown user get the same response (no account enumeration)")
    void noAccountEnumeration() {
        String wrongPassword = given(spec)
                .body(new LoginRequest(TestUsers.ALICE.email, "nope"))
                .post("/api/auth/login").then().statusCode(401).extract().asString();
        String unknownUser = given(spec)
                .body(new LoginRequest("ghost@shoplite.test", "nope"))
                .post("/api/auth/login").then().statusCode(401).extract().asString();

        assertThat(wrongPassword).isEqualTo(unknownUser);
    }

    static Stream<Arguments> invalidBodies() {
        return Stream.of(
                Arguments.of(Map.of(), "email"),
                Arguments.of(Map.of("email", "not-an-email", "password", "x"), "email"),
                Arguments.of(Map.of("email", TestUsers.ALICE.email), "password"),
                Arguments.of(Map.of("email", TestUsers.ALICE.email, "password", 12345), "password"));
    }

    @ParameterizedTest(name = "{0} -> invalid {1}")
    @MethodSource("invalidBodies")
    @DisplayName("invalid login bodies are rejected with 400 and the field name")
    void invalidBodies(Map<String, Object> body, String field) {
        given(spec)
                .body(body)
                .when().post("/api/auth/login")
                .then().statusCode(400)
                .body("field", equalTo(field));
    }

    @Test
    @DisplayName("/me returns the logged-in user and 401 after logout")
    void logoutRevokesToken() {
        String token = tokenFor(TestUsers.BOB);

        given(spec).auth().oauth2(token).get("/api/auth/me")
                .then().statusCode(200).body("email", equalTo(TestUsers.BOB.email));
        given(spec).auth().oauth2(token).post("/api/auth/logout")
                .then().statusCode(204);
        given(spec).auth().oauth2(token).get("/api/auth/me")
                .then().statusCode(401);
    }
}
