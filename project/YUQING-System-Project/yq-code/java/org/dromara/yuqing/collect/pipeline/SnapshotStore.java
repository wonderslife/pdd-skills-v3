package org.dromara.yuqing.collect.pipeline;

import lombok.extern.slf4j.Slf4j;
import org.dromara.common.oss.client.OssClient;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * 采集快照留存（《技术架构说明》§5.7：HTML 原文存 MinIO，保留 30 天，供溯源复核）。
 *
 * <p>快照属于「有更好、没有也能跑」的能力：MinIO 未配置或上传失败时静默降级，只打一行 debug 日志，
 * 不影响采集主链路。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
public class SnapshotStore {

    private final YqCollectProperties props;

    private final ObjectProvider<OssClient> ossClientProvider;

    public SnapshotStore(YqCollectProperties props, ObjectProvider<OssClient> ossClientProvider) {
        this.props = props;
        this.ossClientProvider = ossClientProvider;
    }

    /**
     * 落一份 HTML 快照。
     *
     * @param opinion 原始舆情（读取 rawHtml）
     * @return 对象键；未开启或失败返回 null
     */
    public String store(RawOpinion opinion) {
        if (!props.getSnapshot().isEnabled() || opinion == null || opinion.getRawHtml() == null) {
            return null;
        }
        byte[] bytes = opinion.getRawHtml().getBytes(StandardCharsets.UTF_8);
        if (bytes.length == 0 || bytes.length > props.getSnapshot().getMaxBytes()) {
            log.debug("[采集快照] 内容为空或超限(={}B)，跳过", bytes.length);
            return null;
        }
        OssClient client = ossClientProvider.getIfAvailable();
        if (client == null || !client.isInitialized()) {
            log.debug("[采集快照] 对象存储未就绪，跳过快照");
            return null;
        }
        String key = props.getSnapshot().getKeyPrefix() + "/" + opinion.getCollectDate() + "/" + opinion.getUrlHash() + ".html";
        try {
            client.bucketUpload(props.getSnapshot().getBucket(), key, bytes);
            return key;
        } catch (Exception e) {
            log.warn("[采集快照] 上传失败 key={} err={}", key, e.getMessage());
            return null;
        }
    }
}
