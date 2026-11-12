package com.shoplite.architecture;

import static com.tngtech.archunit.base.DescribedPredicate.alwaysTrue;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTag;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import com.tngtech.archunit.library.GeneralCodingRules;
import org.junit.jupiter.api.Tag;

/**
 * ArchUnit rules for this Java test project. Test code is code too: these rules keep the suites
 * independent, the shared support code free of suite details, and the tests free of habits that
 * make them flaky. ShopLite's own (Node.js) architecture is checked by dependency-cruiser in cfr-tests/.
 */
@ArchTag("architecture")
@AnalyzeClasses(packages = "com.shoplite")
class TestSuiteArchitectureTest {

    @ArchTest
    static final ArchRule suites_are_independent = slices().matching("com.shoplite.(*)..")
            .should().notDependOnEachOther()
            .ignoreDependency(alwaysTrue(), resideInAPackage("com.shoplite.support.."))
            .because("each suite (api, karate, data) can be run, changed or deleted on its own; shared code goes in support");

    @ArchTest
    static final ArchRule support_knows_nothing_about_the_suites = noClasses()
            .that().resideInAPackage("com.shoplite.support..")
            .should().dependOnClassesThat().resideInAnyPackage("com.shoplite.api..", "com.shoplite.karate..", "com.shoplite.data..");

    @ArchTest
    static final ArchRule api_models_are_records = classes()
            .that().resideInAPackage("com.shoplite.api.model..")
            .should(beRecords())
            .because("response models are plain immutable data, compared by value in assertions");

    @ArchTest
    static final ArchRule api_models_are_plain_data = noClasses()
            .that().resideInAPackage("com.shoplite.api.model..")
            .should().dependOnClassesThat().resideInAnyPackage("io.restassured..", "org.junit..", "org.assertj..", "com.intuit.karate..");

    @ArchTest
    static final ArchRule test_classes_are_tagged = classes()
            .that().haveSimpleNameEndingWith("Test")
            .and().doNotHaveModifier(JavaModifier.ABSTRACT)
            .and().resideOutsideOfPackage("com.shoplite.architecture..")
            .should(beTaggedDirectlyOrBySuperclass())
            .because("CI and developers select suites with -Dgroups=<tag>");

    @ArchTest
    static final ArchRule tests_wait_for_conditions_not_time = noClasses()
            .that().resideOutsideOfPackage("com.shoplite.support..")
            .should().callMethod(Thread.class, "sleep", long.class)
            .because("fixed sleeps make tests slow and flaky; poll for a condition (as ShopLiteServer does) instead");

    @ArchTest
    static final ArchRule no_console_output = GeneralCodingRules.NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS
            .because("test output belongs in reports, not in the console");

    @ArchTest
    static final ArchRule no_generic_exceptions = GeneralCodingRules.NO_CLASSES_SHOULD_THROW_GENERIC_EXCEPTIONS;

    private static ArchCondition<JavaClass> beRecords() {
        return new ArchCondition<>("be records") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                boolean isRecord = item.reflect().isRecord();
                events.add(new SimpleConditionEvent(item, isRecord, item.getName() + (isRecord ? " is" : " is not") + " a record"));
            }
        };
    }

    private static ArchCondition<JavaClass> beTaggedDirectlyOrBySuperclass() {
        return new ArchCondition<>("have a JUnit @Tag (directly or on a superclass)") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                boolean tagged = item.isAnnotatedWith(Tag.class)
                        || item.getAllRawSuperclasses().stream().anyMatch(superclass -> superclass.isAnnotatedWith(Tag.class));
                events.add(new SimpleConditionEvent(item, tagged, item.getName() + (tagged ? " has" : " has no") + " @Tag"));
            }
        };
    }
}
