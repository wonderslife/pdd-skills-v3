package org.dromara.inspect.controller;

import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.web.core.BaseController;
import org.dromara.inspect.service.IInspectRecordExtService;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * 巡检照片 Controller（PRD 模块 8）
 * <p>
 * H5 拍照后先调本接口拿到 OSS URL，再把 URL 放进 /inspect/record/submit 的提交体，
 * 避免把图片二进制塞进提交请求。
 * <p>
 * 存储复用若依 OSS（MinIO 自建），原图 + 压缩图成对保存；
 * 返回 map：originalUrl / originalSize / compressedUrl / compressedSize / fileName。
 * PRD 6.3 未配置权限码，登录态由 Sa-Token 全局拦截保证。
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/inspect/photo")
public class InspectPhotoController extends BaseController {

    private final IInspectRecordExtService recordExtService;

    /**
     * 上传照片（original 必传，compressed 可选）
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public R<Map<String, Object>> upload(@RequestPart("original") MultipartFile original,
                                         @RequestPart(value = "compressed", required = false) MultipartFile compressed) {
        return R.ok(recordExtService.uploadPhoto(original, compressed));
    }

}
