package org.dromara.yuqing.collect.pipeline;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.domain.YqCollectLog;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.mapper.YqCollectLogMapper;
import org.dromara.yuqing.mapper.YqOpinionMapper;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * JDBC 落库通道（{@code yuqing.collect.sink.mode=jdbc}）。
 *
 * <p>用途：本地没有 Doris 时，把 {@code doris} 数据源指向一个与 Doris 同名表结构的 MySQL，
 * 先跑通全链路再切 Stream Load（见 config/yq_datasource.yml 与
 * sql/yq_doris_mysql_fallback.sql）。</p>
 *
 * <p>⚠ 本类属于「采集 Worker 侧写入通道」，与业务侧 {@code IYqOpinionService}（只读）职责不同。
 * 业务代码不得引用本类。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
@DS("doris")
public class CollectJdbcWriter {

    private final YqOpinionMapper opinionMapper;

    private final YqCollectLogMapper collectLogMapper;

    /**
     * 批量写入舆情明细。
     *
     * @param list 原始舆情
     * @return 写入条数
     */
    public int insertOpinions(List<RawOpinion> list) {
        if (list == null || list.isEmpty()) {
            return 0;
        }
        List<YqOpinion> entities = new ArrayList<>(list.size());
        for (RawOpinion raw : list) {
            entities.add(toEntity(raw));
        }
        opinionMapper.insertBatch(entities, 500);
        return entities.size();
    }

    /**
     * 写入一条采集日志。
     *
     * @param row 日志实体
     * @return 写入条数
     */
    public int insertLog(YqCollectLog row) {
        if (row == null) {
            return 0;
        }
        if (row.getLogId() == null) {
            row.setLogId(IdWorker.getId());
        }
        if (row.getCreateTime() == null) {
            row.setCreateTime(java.time.LocalDateTime.now());
        }
        return collectLogMapper.insert(row) > 0 ? 1 : 0;
    }

    /**
     * 原始舆情转明细实体。
     *
     * @param raw 原始舆情
     * @return 明细实体
     */
    public static YqOpinion toEntity(RawOpinion raw) {
        YqOpinion entity = new YqOpinion();
        entity.setOpinionId(raw.getOpinionId() == null ? IdWorker.getId() : raw.getOpinionId());
        entity.setCollectDate(raw.getCollectDate());
        entity.setTaskId(raw.getTaskId());
        entity.setChannelId(raw.getChannelId());
        entity.setTitle(raw.getTitle());
        entity.setContent(raw.getContent());
        entity.setOpinionUrl(raw.getOpinionUrl());
        entity.setUrlHash(raw.getUrlHash());
        entity.setPublishTime(raw.getPublishTime());
        entity.setAuthor(raw.getAuthor());
        entity.setLikeCount(raw.getLikeCount());
        entity.setCommentCount(raw.getCommentCount());
        entity.setShareCount(raw.getShareCount());
        entity.setReadCount(raw.getReadCount());
        entity.setRegion(raw.getRegion());
        entity.setDeviceInfo(raw.getDeviceInfo());
        entity.setTopicTags(raw.getTopicTags());
        entity.setCollectSource(raw.getCollectSource());
        entity.setCollectTime(raw.getCollectTime());
        entity.setBatchNo(raw.getBatchNo());
        entity.setCleanStatus("pending");
        entity.setAnalyzeStatus("pending");
        entity.setAlertFlag("0");
        entity.setPushFlag("0");
        entity.setDelFlag("0");
        return entity;
    }
}
