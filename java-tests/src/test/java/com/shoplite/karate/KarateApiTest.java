package com.shoplite.karate;

import com.intuit.karate.Results;
import com.intuit.karate.Runner;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Runs every Karate feature under this package in parallel and fails if any scenario fails. */
@Tag("karate")
class KarateApiTest {

    @Test
    void runAllFeatures() {
        Results results = Runner.path("classpath:com/shoplite/karate")
                .tags("~@ignore")
                .outputJunitXml(true)
                .parallel(3);
        assertThat(results.getFailCount())
                .as(results.getErrorMessages())
                .isZero();
    }
}
