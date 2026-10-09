package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.web.core.BaseController;
import org.dromara.yuqing.collect.keyword.KeywordImportRequest;
import org.dromara.yuqing.collect.keyword.KeywordImportResult;
import org.dromara.yuqing.service.IYqKeywordImportService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 关键词词表导入 Controller。
 *
 * <p>独立于 {@code YqKeywordController}（后者由字段生成器产出），
 * 避免生成器与手写扩展互相覆盖。</p>
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/keyword/import")
public class YqKeywordImportController extends BaseController {

    private final IYqKeywordImportService keywordImportService;

    /**
     * 解析预览：返回条目、错误与统计，不写库。
     */
    @SaCheckPermission("yuqing:keyword:add")
    @PostMapping("/parse")
    public R<KeywordImportResult> parse(@RequestBody(required = false) KeywordImportRequest request) {
        return R.ok(keywordImportService.preview(request == null ? null : request.getText()));
    }

    /**
     * 解析并入库。
     */
    @SaCheckPermission("yuqing:keyword:add")
    @Log(title = "关键词词表导入", businessType = BusinessType.INSERT)
    @PostMapping("/commit")
    public R<KeywordImportResult> commit(@RequestBody(required = false) KeywordImportRequest request) {
        if (request == null || StringUtils.isBlank(request.getText())) {
            return R.fail("导入内容不能为空");
        }
        KeywordImportResult result = keywordImportService.commit(
            request.getText(), request.getTaskId(), request.getGroupId(),
            request.getGroupName(), request.getMatchStrategy());
        if (!result.isOk()) {
            return R.fail(result.getErrors().get(0), result);
        }
        return R.ok(result);
    }
}
