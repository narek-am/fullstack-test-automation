package com.shoplite.api.model;

import java.util.List;

public record Cart(List<Line> items, int subtotalCents, int shippingCents, int totalCents) {

    public record Line(int productId, String name, String image, int unitPriceCents, int stock, int quantity) {
    }
}
