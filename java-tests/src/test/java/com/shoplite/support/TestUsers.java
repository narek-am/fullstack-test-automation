package com.shoplite.support;

/** Seeded accounts from app/src/seed.js. */
public enum TestUsers {
    ALICE("alice@shoplite.test", "Passw0rd!"),
    BOB("bob@shoplite.test", "Passw0rd!"),
    ADMIN("admin@shoplite.test", "Adm1nPass!");

    public final String email;
    public final String password;

    TestUsers(String email, String password) {
        this.email = email;
        this.password = password;
    }
}
