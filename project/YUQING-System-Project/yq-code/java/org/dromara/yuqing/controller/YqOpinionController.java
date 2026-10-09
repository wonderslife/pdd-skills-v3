package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.domain.R;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.web.core.BaseController;
import org.dromara.yuqing.domain.YqLedgerExportLog;
import org.dromara.yuqing.ledger.domain.LedgerDetail;
import org.dromara.yuqing.ledger.domain.LedgerExportBo;
import org.dromara.yuqing.ledger.domain.LedgerExportResult;
import org.dromara.yuqing.ledger.domain.LedgerPage;
import org.dromara.yuqing.ledger.domain.LedgerQuery;
import org.dromara.yuqing.ledger.domain.LedgerSearchResult;
import org.dromara.yuqing.ledger.service.IYqLedgerExportService;
import org.dromara.yuqing.ledger.service.IYqLedgerService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 舆情台账控制器（F-016）
 *
 * <p><b>端点总览（PRD §6.3）：</b></p>
 * <ul>
 *   <li>{@code GET  /yuqing/opinion/list}            台账组合筛选分页（标准 1、2）</li>
 *   <li>{@code GET  /yuqing/opinion/{opinionId}}     舆情详情（标准 3）</li>
 *   <li>{@code GET  /yuqing/opinion/search}          全文检索 + 高亮（标准 7）</li>
 *   <li>{@code POST /yuqing/opinion/export}          导出（标准 5、6）</li>
 *   <li>{@code GET  /yuqing/opinion/export/{id}}     异步导出状态（标准 6）</li>
 *   <li>{@code GET  /yuqing/opinion/exportLog/list}  导出审计记录（标准 10）</li>
 * </ul>
 *
 * <p><b>路径顺序（重要）：</b>固定路径（{@code /search}、{@code /export}、
 * {@code /exportLog/list}）必须在 {@code /{opinionId}} 之前声明。Spring MVC
 * 的路径匹配虽能区分「字面量」与「变量」，但 {@code /{opinionId}} 用
 * {@code Long} 绑定，误命中时会抛类型转换 400；显式前置可让路由意图
 * 在代码里一目了然，也避免后续有人把某个固定路径挪到后面时踩坑。</p>
 *
 * <p><b>权限：</b>沿用菜单已有的 {@code yuqing:opinion:*} 权限码
 * （list / query / export）—— F-016 不引入新菜单，因此不新增权限码。
 * 前端必须使用同一枚权限码控制按钮显隐，否则会出现「按钮看得见、点了 403」。</p>
 *
 * <p><b>安全：</b>所有查询条件来自请求参数，但「可见范围」一律由
 * Service 内部从 Sa-Token 推导（决策 ③A 按任务归属隔离），
 * 请求体无法扩大可见范围。</p>
 *
 * @author ruoyi
 */
@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/yuqing/opinion")
public class YqOpinionController extends BaseController {

    private final IYqLedgerService ledgerService;
    private final IYqLedgerExportService exportService;

    /**
     * 台账组合筛选分页（验收标准 1、2、8、9）
     *
     * <p>把 11 个筛选维度直接铺开成方法参数（而非用一个 {@code @ModelAttribute}
     * 对象）：GET 参数与前端查询表单一一对应，且 {@code LedgerQuery} 是
     * 业务对象、不携带 Web 层关注点。时间类参数用 String 接收，
     * 由 {@code LedgerTimeParser} 容错解析（非法值忽略而不是 400）。</p>
     */
    @SaCheckPermission("yuqing:opinion:list")
    @GetMapping("/list")
    public R<LedgerPage> list(
        @RequestParam(required = false) String collectBeginTime,
        @RequestParam(required = false) String collectEndTime,
        @RequestParam(required = false) String publishBeginTime,
        @RequestParam(required = false) String publishEndTime,
        @RequestParam(required = false) Long taskId,
        @RequestParam(required = false) Long channelId,
        @RequestParam(required = false) String sentiAttr,
        @RequestParam(required = false) String riskLevel,
        @RequestParam(required = false) String opinionLevel,
        @RequestParam(required = false) String spreadLevel,
        @RequestParam(required = false) String collectSource,
        @RequestParam(required = false) String cleanStatus,
        @RequestParam(required = false) String analyzeStatus,
        @RequestParam(required = false) String alertFlag,
        @RequestParam(required = false) java.util.List<Long> tagIds,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String keywordScope,
        @RequestParam(required = false) Long clusterId,
        @RequestParam(required = false) String orderBy,
        @RequestParam(required = false) Boolean orderDesc,
        PageQuery pageQuery) {
        LedgerQuery q = new LedgerQuery();
        q.setCollectBeginTime(collectBeginTime);
        q.setCollectEndTime(collectEndTime);
        q.setPublishBeginTime(publishBeginTime);
        q.setPublishEndTime(publishEndTime);
        q.setTaskId(taskId);
        q.setChannelId(channelId);
        q.setSentiAttr(sentiAttr);
        q.setRiskLevel(riskLevel);
        q.setOpinionLevel(opinionLevel);
        q.setSpreadLevel(spreadLevel);
        q.setCollectSource(collectSource);
        q.setCleanStatus(cleanStatus);
        q.setAnalyzeStatus(analyzeStatus);
        q.setAlertFlag(alertFlag);
        q.setTagIds(tagIds);
        q.setKeyword(keyword);
        q.setKeywordScope(keywordScope);
        q.setClusterId(clusterId);
        q.setOrderBy(orderBy);
        q.setOrderDesc(orderDesc);
        return R.ok(ledgerService.queryPage(q, pageQuery));
    }

    /**
     * 舆情详情（验收标准 3）
     *
     * <p>不在可见范围内时返回统一话术「无权查看该舆情，或该舆情已不存在」，
     * 不区分两者 —— 避免通过响应差异探测他人数据的 ID 是否存在。</p>
     */
    @SaCheckPermission("yuqing:opinion:query")
    @GetMapping("/{opinionId}")
    public R<LedgerDetail> detail(@PathVariable Long opinionId) {
        return R.ok(ledgerService.detail(opinionId));
    }

    /**
     * 全文检索（验收标准 7）
     *
     * <p>返回命中片段（已做 HTML 转义 + 命中标记），前端直接 {@code v-html}
     * 渲染即安全 —— 转义在服务端 {@code LedgerHighlighter} 里完成。</p>
     *
     * @param keyword 检索词
     * @param scope   检索范围 title / content / both，空则 both
     * @param limit   命中条数上限，空则用配置值
     */
    @SaCheckPermission("yuqing:opinion:list")
    @GetMapping("/search")
    public R<LedgerSearchResult> search(
        @RequestParam String keyword,
        @RequestParam(required = false) String scope,
        @RequestParam(required = false) Integer limit) {
        return R.ok(ledgerService.search(keyword, scope, limit));
    }

    /**
     * 导出（验收标准 5、6）
     *
     * <p>返回体 {@code mode} 决定前端行为：{@code sync} 直接打开
     * {@code fileUrl}；{@code async} 提示已在后台导出并轮询
     * {@code /export/{exportId}}。</p>
     */
    @SaCheckPermission("yuqing:opinion:export")
    @PostMapping("/export")
    public R<LedgerExportResult> export(@Valid @RequestBody LedgerExportBo bo) {
        return R.ok(exportService.export(bo));
    }

    /** 异步导出任务状态（验收标准 6） */
    @SaCheckPermission("yuqing:opinion:export")
    @GetMapping("/export/{exportId}")
    public R<LedgerExportResult> exportStatus(@PathVariable Long exportId) {
        return R.ok(exportService.status(exportId));
    }

    /**
     * 导出审计记录（验收标准 10）
     *
     * <p>返回结构与本模块其它列表页一致（{@code R<PageResult<T>>}），
     * 前端复用同一套表格分页封装。</p>
     */
    @SaCheckPermission("yuqing:opinion:export")
    @GetMapping("/exportLog/list")
    public R<PageResult<YqLedgerExportLog>> exportLogList(
        PageQuery pageQuery,
        @RequestParam(required = false) String exportScope) {
        return R.ok(exportService.logPage(pageQuery, exportScope));
    }
}
