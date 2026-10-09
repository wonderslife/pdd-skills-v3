package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.io.Serial;

/**
 * 知识库案例对象 yq_knowledge
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_knowledge")
@ExcelIgnoreUnannotated
public class YqKnowledge extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 案例ID,主键 */
    @TableId(value = "knowledge_id")
    private Long knowledgeId;

    /** 来源舆情ID */
    private Long opinionId;

    /** 案例类型 */
    @ExcelProperty(value = "案例类型")
    private String caseType;

    /** 案例标题 */
    @ExcelProperty(value = "案例标题")
    private String caseTitle;

    /** 原始数据快照（JSON） */
    private String originData;

    /** 舆情链接 */
    private String opinionUrl;

    /** 研判结果快照 */
    private String analyzeResult;

    /** 分级标签 */
    @ExcelProperty(value = "分级标签")
    private String levelTags;

    /** 处置记录 */
    @ExcelProperty(value = "处置记录")
    private String processRecord;

    /** 人工修正标注 */
    private String manualCorrection;

    /** 场景分类 */
    @ExcelProperty(value = "场景分类")
    private String sceneCategory;

    /** 风险特征 */
    private String riskFeature;

    /** 关键词特征 */
    private String keywordFeature;

    /** 状态（0有效 1已淘汰） */
    private String status;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
