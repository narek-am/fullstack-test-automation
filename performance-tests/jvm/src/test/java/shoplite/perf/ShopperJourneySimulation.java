package shoplite.perf;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

import io.gatling.javaapi.core.ChainBuilder;
import io.gatling.javaapi.core.ScenarioBuilder;
import io.gatling.javaapi.core.Simulation;
import io.gatling.javaapi.http.HttpProtocolBuilder;
import java.time.Duration;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Realistic traffic mix for ShopLite: many anonymous visitors browsing, and a smaller group of
 * customers who log in, add to the cart and check out. Uses an open workload model (new users
 * arrive at a given rate whether or not earlier ones are done), which is how real web traffic behaves.
 *
 * <p>Run: start the app with ../scripts/start-app.mjs, then ./mvnw gatling:test
 */
public class ShopperJourneySimulation extends Simulation {

    private static final String BASE_URL = System.getProperty("baseUrl", "http://127.0.0.1:3400");
    private static final int PRODUCT_COUNT = 6;
    private static final int IN_STOCK_PRODUCTS = 5; // product 6 is sold out

    private final HttpProtocolBuilder httpProtocol = http.baseUrl(BASE_URL)
            .acceptHeader("application/json")
            .contentTypeHeader("application/json")
            .userAgentHeader("ShopLite load test (Gatling)");

    private final ChainBuilder browse = exec(http("home page").get("/").header("Accept", "text/html").check(status().is(200)))
            .pause(Duration.ofMillis(500), Duration.ofSeconds(2))
            .exec(http("product list").get("/api/products")
                    .check(status().is(200), jsonPath("$.total").ofInt().is(PRODUCT_COUNT)))
            .pause(Duration.ofMillis(500), Duration.ofSeconds(2))
            .exec(http("search").get("/api/products?search=book&sort=price_asc")
                    .check(status().is(200), jsonPath("$.items[0].sku").is("BK-001")))
            .pause(Duration.ofMillis(500), Duration.ofSeconds(2))
            .exec(http("product detail")
                    .get(session -> "/api/products/" + ThreadLocalRandom.current().nextInt(1, PRODUCT_COUNT + 1))
                    .check(status().is(200)));

    private final ChainBuilder buy = exec(http("login").post("/api/auth/login")
                    .body(StringBody("{\"email\":\"#{email}\",\"password\":\"#{password}\"}"))
                    .check(status().is(200), jsonPath("$.token").saveAs("token")))
            .exec(session -> session.set("productId", ThreadLocalRandom.current().nextInt(1, IN_STOCK_PRODUCTS + 1)))
            .pause(Duration.ofMillis(500), Duration.ofSeconds(2))
            .exec(http("add to cart").post("/api/cart/items")
                    .header("Authorization", "Bearer #{token}")
                    .body(StringBody("{\"productId\": #{productId}, \"quantity\": 1}"))
                    .check(status().is(201)))
            .pause(Duration.ofMillis(500), Duration.ofSeconds(2))
            .exec(http("view cart").get("/api/cart")
                    .header("Authorization", "Bearer #{token}")
                    .check(status().is(200), jsonPath("$.items[0].productId").ofInt().isEL("#{productId}")))
            .exec(http("place order").post("/api/orders")
                    .header("Authorization", "Bearer #{token}")
                    .check(status().is(201), jsonPath("$.id").saveAs("orderId")))
            .exec(http("order detail").get("/api/orders/#{orderId}")
                    .header("Authorization", "Bearer #{token}")
                    .check(status().is(200)));

    // users.csv has 50 users and exactly 50 buyers arrive, so no two buyers share a cart.
    private final ScenarioBuilder visitors = scenario("Browsing visitor").exec(browse);
    private final ScenarioBuilder buyers = scenario("Buyer").feed(csv("users.csv").queue()).exec(browse, buy);

    {
        setUp(
                visitors.injectOpen(
                        rampUsersPerSec(1).to(10).during(Duration.ofSeconds(20)),
                        constantUsersPerSec(10).during(Duration.ofSeconds(40))),
                buyers.injectOpen(rampUsers(50).during(Duration.ofSeconds(60))))
                .protocols(httpProtocol)
                .assertions(
                        global().failedRequests().percent().lt(1.0),
                        global().responseTime().percentile(95.0).lt(500),
                        details("login").responseTime().percentile(95.0).lt(2000),
                        details("place order").responseTime().percentile(95.0).lt(500));
    }
}
