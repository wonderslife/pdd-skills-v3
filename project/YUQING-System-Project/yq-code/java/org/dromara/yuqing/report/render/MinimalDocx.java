package org.dromara.yuqing.report.render;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * 最小合法 .docx 构造器（纯函数）
 *
 * <p>docx 本质是一个 zip，至少要含 [Content_Types].xml、_rels/.rels、
 * word/document.xml 三个条目。这里按 OOXML 最小子集手工拼一份，
 * 供 {@link WordRenderer} 作为 poi-tl 的编译输入。</p>
 *
 * <p>为什么不放在 resources 下做成二进制资源：生成器体系只产文本文件，
 * 二进制资源会让「一个产物一个归属」的校验失效。构造逻辑在这里是代码，
 * 可读、可测、可 diff。</p>
 *
 * @author ruoyi
 */
final class MinimalDocx {

    private static final String CONTENT_TYPES = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
        </Types>""";

    private static final String RELS = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
        </Relationships>""";

    /**
     * 构造含两个占位段落的最小 docx
     *
     * @param titlePlaceholder 标题占位符（如 {{title}}）
     * @param bodyPlaceholder  正文占位符（如 {{body}}）
     */
    static byte[] build(String titlePlaceholder, String bodyPlaceholder) {
        String doc = """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
              <w:body>
                <w:p><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>
                <w:p><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>
                <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
              </w:body>
            </w:document>""".formatted(xml(titlePlaceholder), xml(bodyPlaceholder));
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(bos)) {
                put(zip, "[Content_Types].xml", CONTENT_TYPES);
                put(zip, "_rels/.rels", RELS);
                put(zip, "word/document.xml", doc);
            }
            return bos.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("构造最小 docx 失败: " + e.getMessage(), e);
        }
    }

    private static void put(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static String xml(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private MinimalDocx() {
    }
}
