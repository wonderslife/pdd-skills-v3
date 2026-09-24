import upload from '@/utils/upload'

/**
 * 上传巡检照片
 * <p>
 * 说明：uni.uploadFile 一次只能携带一个文件，因此 H5 只上传原图（name=original）。
 * 后端在缺少 compressed 时会自动用原图 URL 兜底填充 compressedUrl，
 * 从而满足「异常项必须至少 1 张照片」的校验，并保证原图/压缩图两个字段都非空。
 *
 * @param {string} filePath 本地临时文件路径（uni.chooseImage 返回）
 */
export function uploadInspectPhoto(filePath) {
  return upload({
    url: '/inspect/photo/upload',
    name: 'original',
    filePath,
  })
}
