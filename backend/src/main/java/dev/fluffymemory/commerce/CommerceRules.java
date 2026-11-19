package dev.fluffymemory.commerce;

import dev.fluffymemory.ApiException;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class CommerceRules {
    static final int MAX_LINES = 50;

    private CommerceRules() {}

    static String requiredText(String input, int limit, String label) {
        String result = optionalText(input, limit, label);
        if (result == null) {
            throw ApiException.badRequest("请填写" + label);
        }
        return result;
    }

    static String optionalText(String input, int limit, String label) {
        if (input == null || input.isBlank()) {
            return null;
        }
        String value = input.strip();
        if (value.length() > limit || value.indexOf('\0') >= 0) {
            throw ApiException.badRequest(label + "格式有误或超过 " + limit + " 个字符");
        }
        return value;
    }

    static int quantity(Integer quantity) {
        if (quantity == null || quantity < 1 || quantity > 99) {
            throw ApiException.badRequest("购买数量须为 1 至 99");
        }
        return quantity;
    }

    static Set<Long> selection(List<Long> values, String label) {
        if (values.isEmpty() || values.size() > MAX_LINES) {
            throw ApiException.badRequest("请选择 1 至 " + MAX_LINES + " 个" + label);
        }
        Set<Long> selected = new LinkedHashSet<>();
        for (Long value : values) {
            if (value == null || value < 1 || !selected.add(value)) {
                throw ApiException.badRequest(label + "编号有误或重复");
            }
        }
        return selected;
    }
}
