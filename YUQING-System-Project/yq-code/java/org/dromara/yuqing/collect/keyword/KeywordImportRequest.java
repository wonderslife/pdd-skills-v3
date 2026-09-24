package org.dromara.yuqing.collect.keyword;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 词表导入请求体。
 *
 * @author ruoyi
 */
@Data
public class KeywordImportRequest implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 词表原文（PC 端读取 .txt 后原样提交） */
    private String text;

    /** 绑定到的监测任务ID；为空表示只入库到关键词库、不建任务关联 */
    private Long taskId;

    /** 关键词分组ID；为空则按 groupName 查找或新建 */
    private Long groupId;

    /** 分组名称（groupId 为空时生效） */
    private String groupName;

    /** 任务级匹配策略（覆盖全局）：strict / loose / off，可为空 */
    private String matchStrategy;
}
