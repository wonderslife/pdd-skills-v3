package org.dromara.yuqing.collect.json;

import org.dromara.common.json.utils.JsonUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 采集引擎的 JSON 门面。
 *
 * <p><b>为什么不直接用 {@link JsonUtils}：</b>该工具的 {@code JSON_MAPPER} 是
 * {@code SpringUtils.getBean(JsonMapper.class)} 取的容器 Bean，静态字段初始化失败会抛
 * {@code ExceptionInInitializerError} —— 采集引擎需要在 Spring 上下文之外也能跑
 * （离线自测、未来的采集 Worker CLI、Stream Load 单测），因此这里做一层兜底：
 * 容器可用时用全局配置好的 mapper（保证与 Web 层序列化策略一致），
 * 容器不可用时退回自建实例。</p>
 *
 * <p>注意：本工程用的是 <b>Jackson 3</b>（{@code tools.jackson}），
 * 不是 Jackson 2 的 {@code com.fasterxml.jackson}。</p>
 *
 * @author ruoyi
 */
public final class CollectJson {

    /** 容器不可用时的兜底 mapper，双检锁懒加载。 */
    private static volatile JsonMapper fallback;

    private CollectJson() {
    }

    /**
     * 解析 JSON 字符串为树。
     *
     * @param text JSON 文本
     * @return 根节点
     */
    public static JsonNode readTree(String text) {
        return mapper().readTree(text);
    }

    /**
     * 序列化为 JSON 字符串。
     *
     * @param object 待序列化对象
     * @return JSON 文本
     */
    public static String toJsonString(Object object) {
        return mapper().writeValueAsString(object);
    }

    /**
     * 取 JSON 映射器：优先容器 Bean，取不到则用自建实例。
     *
     * @return JsonMapper
     */
    public static JsonMapper mapper() {
        try {
            JsonMapper bean = JsonUtils.getJsonMapper();
            if (bean != null) {
                return bean;
            }
        } catch (Throwable ignore) {
            /* 容器未启动 / 静态初始化失败：走兜底实例，不打扰调用方 */
        }
        JsonMapper local = fallback;
        if (local == null) {
            synchronized (CollectJson.class) {
                local = fallback;
                if (local == null) {
                    local = JsonMapper.builder().build();
                    fallback = local;
                }
            }
        }
        return local;
    }
}
