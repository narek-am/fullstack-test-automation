package com.shoplite.api.model;

public record Product(int id, String sku, String name, String description, String category,
                      int priceCents, int stock, boolean inStock, String image) {
}
