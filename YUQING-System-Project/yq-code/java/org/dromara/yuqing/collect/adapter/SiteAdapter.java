package org.dromara.yuqing.collect.adapter;

import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.RawOpinion;

import java.util.List;

/**
 * 站点适配器 SPI。
 *
 * <p>新站点接入不改代码：新增一个 {@link AdapterSpec} 配置即可。需要新抓取通道（如渲染、APP 接口）
 * 时才实现本接口并注册为 Bean。</p>
 *
 * @author ruoyi
 */
public interface SiteAdapter {

    /**
     * 入口类型标识，与 {@link AdapterSpec#getEntryType()} 对应。
     *
     * @return static / render / api / mock
     */
    String entryType();

    /**
     * 抓取一批原始舆情（未去重、未净化）。
     *
     * @param unit 采集单元
     * @param spec 适配器配置
     * @param ctx  运行上下文
     * @return 原始舆情列表
     * @throws Exception 抓取或解析失败
     */
    List<RawOpinion> fetch(CollectUnit unit, AdapterSpec spec, AdapterContext ctx) throws Exception;
}
