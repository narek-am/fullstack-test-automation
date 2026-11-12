package com.shoplite.api.model;

import java.util.List;

public record Order(int id, int userId, String status, int totalCents, String createdAt, List<Item> items) {

    public record Item(int productId, String name, int quantity, int unitPriceCents) {
    }
}
