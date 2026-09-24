package org.dromara.yuqing.collect.adapter;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 站点适配器注册表。
 *
 * <p>配置来自 {@code yuqing.collect.adapters}，按 {@code entryType} 路由到对应实现。
 * {@code render} 类型在未接入 Playwright 渲染通道前降级为静态解析（对 SSR 页面可用），并打印一次告警。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdapterRegistry {

    private final YqCollectProperties props;

    private final List<SiteAdapter> adapters;

    private final Map<String, SiteAdapter> byType = new HashMap<>();

    @PostConstruct
    public void init() {
        for (SiteAdapter adapter : adapters) {
            byType.put(adapter.entryType().toLowerCase(), adapter);
        }
        if (props.getAdapters() != null) {
            for (Map.Entry<String, AdapterSpec> entry : props.getAdapters().entrySet()) {
                AdapterSpec spec = entry.getValue();
                if (spec == null) {
                    continue;
                }
                if (spec.getCode() == null || spec.getCode().isBlank()) {
                    spec.setCode(entry.getKey());
                }
                SiteAdapter adapter = byType.get(String.valueOf(spec.getEntryType()).toLowerCase());
                if (adapter == null) {
                    log.warn("[采集适配器] {} 声明的 entryType={} 无对应实现，将回退静态解析",
                        entry.getKey(), spec.getEntryType());
                }
            }
        }
        log.info("[采集适配器] 已加载 {} 个站点适配器，通道实现 {} 个: {}", codes().size(), byType.size(), byType.keySet());
    }

    /**
     * 取适配器配置。
     *
     * @param code 适配器标识（yq_channel.adapter_class）
     * @return 配置
     * @throws ServiceException 未配置时抛出，携带可读原因
     */
    public AdapterSpec spec(String code) {
        if (code == null || code.isBlank()) {
            throw new ServiceException("渠道未绑定站点适配器（adapter_class 为空）");
        }
        AdapterSpec spec = props.getAdapters() == null ? null : props.getAdapters().get(code);
        if (spec == null) {
            throw new ServiceException("未找到站点适配器配置: " + code + "，请在 yuqing.collect.adapters 中补充");
        }
        return spec;
    }

    /**
     * 按配置路由到适配器实现。
     *
     * @param spec 适配器配置
     * @return 适配器实现
     */
    public SiteAdapter adapterFor(AdapterSpec spec) {
        String type = spec.getEntryType() == null ? "static" : spec.getEntryType().trim().toLowerCase();
        SiteAdapter adapter = byType.get(type);
        if (adapter == null && "render".equals(type)) {
            adapter = byType.get("static");
            if (adapter != null) {
                log.warn("[采集适配器] {} 为 render 通道，但未接入 Playwright，已降级为静态解析", spec.getCode());
            }
        }
        if (adapter == null) {
            throw new ServiceException("适配器 " + spec.getCode() + " 的 entryType=" + type + " 无可用实现");
        }
        return adapter;
    }

    /**
     * 全部适配器标识。
     *
     * @return 标识列表
     */
    public List<String> codes() {
        return props.getAdapters() == null ? new ArrayList<>() : new ArrayList<>(props.getAdapters().keySet());
    }

    /**
     * 是否存在指定适配器。
     *
     * @param code 标识
     * @return true 表示已配置
     */
    public boolean has(String code) {
        return code != null && props.getAdapters() != null && props.getAdapters().containsKey(code);
    }
}
