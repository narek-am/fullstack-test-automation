package com.shoplite.support;

import java.io.IOException;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Comparator;
import java.util.Optional;

/**
 * Gives the tests a running ShopLite instance.
 *
 * <p>If {@code -Dshoplite.baseUrl=...} (or env {@code SHOPLITE_BASE_URL}) is set, that instance is used as-is.
 * Otherwise the Node app is started once per JVM on a free port with a fresh database,
 * and stopped when the JVM exits.
 */
public final class ShopLiteServer {

    private static String baseUrl;
    private static Process process;
    private static Path tempDir;
    private static Path dbPath;

    private ShopLiteServer() {
    }

    public static synchronized String baseUrl() {
        if (baseUrl == null) {
            String configured = System.getProperty("shoplite.baseUrl", System.getenv("SHOPLITE_BASE_URL"));
            baseUrl = (configured != null && !configured.isBlank()) ? configured.replaceAll("/$", "") : start();
        }
        return baseUrl;
    }

    /**
     * The SQLite file of the instance started by this class, for JDBC data checks.
     * Empty when the tests run against an external instance (-Dshoplite.baseUrl).
     */
    public static synchronized Optional<Path> dbPath() {
        baseUrl();
        return Optional.ofNullable(dbPath);
    }

    private static String start() {
        try {
            int port = freePort();
            tempDir = Files.createTempDirectory("shoplite-java-");
            Path appDir = Path.of(System.getProperty("shoplite.appDir", "../app")).toAbsolutePath().normalize();

            ProcessBuilder builder = new ProcessBuilder("node", "src/index.js")
                    .directory(appDir.toFile())
                    .redirectErrorStream(true)
                    .redirectOutput(tempDir.resolve("server.log").toFile());
            builder.environment().put("PORT", String.valueOf(port));
            dbPath = tempDir.resolve("test.db");
            builder.environment().put("DB_PATH", dbPath.toString());
            // Tests log in a lot; rate limiting has its own dedicated tests.
            builder.environment().put("LOGIN_RATE_LIMIT", "10000");
            process = builder.start();
            Runtime.getRuntime().addShutdownHook(new Thread(ShopLiteServer::stop));

            String url = "http://127.0.0.1:" + port;
            waitUntilHealthy(url);
            return url;
        } catch (IOException e) {
            throw new IllegalStateException("Could not start ShopLite. Is Node.js installed and app/ npm-installed?", e);
        }
    }

    private static void waitUntilHealthy(String url) {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder(URI.create(url + "/api/health"))
                .timeout(Duration.ofSeconds(2)).build();
        long deadline = System.currentTimeMillis() + 20_000;
        while (System.currentTimeMillis() < deadline) {
            if (!process.isAlive()) {
                throw new IllegalStateException("ShopLite exited early, see " + tempDir.resolve("server.log"));
            }
            try {
                if (client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode() == 200) {
                    return;
                }
            } catch (IOException ignored) {
                // not listening yet
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(e);
            }
            sleep(200);
        }
        throw new IllegalStateException("ShopLite did not become healthy within 20s");
    }

    private static void stop() {
        if (process != null) {
            process.destroy();
        }
        if (tempDir != null) {
            try (var paths = Files.walk(tempDir)) {
                paths.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
            } catch (IOException ignored) {
                // best effort cleanup
            }
        }
    }

    private static int freePort() throws IOException {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        }
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
