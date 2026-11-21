/**
 * Contract Bridge - 后端契约 → Kotlin 契约产物
 *
 * 复用 contract-discovery 的解析结果或标准 OpenAPI 文档，
 * 生成 Kotlin data class（DTO）+ Retrofit interface（含 suspend 函数）。
 *
 * 支持两种输入：
 *  - OpenAPI 文档：{ paths, components.schemas }
 *  - ContractDiscovery 报告：[{ method, path, name, params, responses }]
 *
 * 序列化库：moshi（默认）/ kotlinx-serialization / gson，由 android.serializer 配置。
 * 见 docs/plans/04-kotlin-android-capability-enhancement.md §4.2.4。
 */

const PRIMITIVE_MAP = {
  string: 'String',
  integer: 'Int',
  number: 'Double',
  boolean: 'Boolean'
};

/** Java 类型（contract-discovery parameters）→ Kotlin 类型 */
const JAVA_TYPE_MAP = {
  Long: 'Long', Integer: 'Int', Int: 'Int', String: 'String',
  Boolean: 'Boolean', Double: 'Double', Float: 'Double', Short: 'Short',
  'java.lang.Long': 'Long', 'java.lang.String': 'String', 'java.lang.Integer': 'Int'
};

function toPascalCase(name) {
  return name.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, c => c.toUpperCase());
}

function toCamelCase(name) {
  const p = toPascalCase(name);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/** snake_case / kebab-case 属性名是否需要 @Json/@SerialName 注解 */
function needsRename(propName, camelName) {
  return propName !== camelName;
}

/** OpenAPI schema → Kotlin 类型 */
function schemaToKotlin(schema, schemas, visited = new Set()) {
  if (!schema) return 'Any?';
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop();
    if (visited.has(name)) return name;
    return name;
  }
  if (schema.type === 'array') {
    return `List<${schemaToKotlin(schema.items, schemas, visited)}>`;
  }
  if (schema.type === 'object' && schema.properties) {
    return 'Map<String, Any?>';
  }
  if (schema.enum && schema.enum.length) return 'String';
  return PRIMITIVE_MAP[schema.type] || 'Any?';
}

/** 生成 DTO data class 代码 */
function buildDataClass(name, schema, serializer) {
  const props = schema.properties || {};
  const required = new Set(schema.required || []);
  const lines = [];
  for (const [propName, propSchema] of Object.entries(props)) {
    const camel = toCamelCase(propName);
    const kotlinType = schemaToKotlin(propSchema, schema.properties);
    const nullable = required.has(propName) ? '' : '? = null';
    const annotation =
      serializer === 'kotlinx-serialization' && needsRename(propName, camel)
        ? `    @SerialName("${propName}")\n`
        : serializer === 'moshi' && needsRename(propName, camel)
          ? `    @Json(name = "${propName}")\n`
          : '';
    lines.push(`${annotation}    val ${camel}: ${kotlinType}${nullable}`);
  }
  return lines.join(',\n');
}

/** 由 discovery 端点推导 DTO 名 */
function dtoNameForEndpoint(ep) {
  const base = toPascalCase(ep.name || ep.operationId || ep.path.replace(/[{}\/]/g, '-'));
  return /^(Get|Post|Put|Delete|Patch)(.+)$/.test(base) ? base : base;
}

/**
 * 生成 Kotlin 契约产物
 *
 * @param {object|string} input OpenAPI 文档或 ContractDiscovery.analyze() 的 contracts.endpoints
 * @param {{serializer?: string, namespace?: string, apiResultWrapper?: string|null}} options
 * @returns {{files: Array<{path: string, content: string}>, summary: {dtos: number, endpoints: number}}}
 */
export function generate(input, options = {}) {
  const serializer = options.serializer || 'moshi';
  const namespace = options.namespace || 'com.example.app';
  const wrapper = options.apiResultWrapper === undefined ? 'ApiResult' : options.apiResultWrapper;

  const schemas = [];   // { name, code }
  const apiMethods = [];
  const dtoImports = new Set();

  const addSchema = (name, schema) => {
    if (!schema || !schema.properties || schemas.some(s => s.name === name)) return;
    schemas.push({ name, code: buildDataClass(name, schema, serializer) });
    // 引用到的其他 schema 一并生成
    for (const prop of Object.values(schema.properties)) {
      if (prop?.$ref) {
        addSchema(prop.$ref.split('/').pop(), resolveSchema(prop.$ref, input));
      }
      if (prop?.items?.$ref) {
        addSchema(prop.items.$ref.split('/').pop(), resolveSchema(prop.items.$ref, input));
      }
    }
  };

  function resolveSchema(ref, doc) {
    if (doc && doc.components && doc.components.schemas) {
      return doc.components.schemas[ref.split('/').pop()] || null;
    }
    return null;
  }

  let endpoints = [];
  if (Array.isArray(input)) {
    // ContractDiscovery 端点格式：{ httpMethod, fullPath, methodName, parameters, returnType }
    endpoints = input
      .filter(ep => (ep.httpMethod || '').toUpperCase() !== 'ANY') // 类级 @RequestMapping 无法确定动词，跳过
      .map(ep => ({
        method: (ep.httpMethod || ep.method || 'GET').toUpperCase(),
        path: ep.fullPath || ep.path || ep.url || '',
        name: ep.methodName || ep.operationId || ep.name || '',
        params: ep.parameters || ep.params || [],
        response: ep.returnType || ep.response || null
      }));
  } else if (input && input.paths) {
    // OpenAPI 文档
    for (const [p, methods] of Object.entries(input.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;
        endpoints.push({
          method: method.toUpperCase(),
          path: p,
          name: op.operationId || '',
          params: op.parameters || [],
          response: op.responses?.['200']?.content?.['*/*']?.schema
            || op.responses?.['200']?.content?.['application/json']?.schema
            || null
        });
      }
    }
    if (input.components?.schemas) {
      for (const [name, schema] of Object.entries(input.components.schemas)) {
        addSchema(name, schema);
      }
    }
  }

  // 端点 → Retrofit 方法
  const dtoNames = new Set();
  for (const ep of endpoints) {
    const funcName = toCamelCase(ep.name || `${ep.method.toLowerCase()}_${ep.path.replace(/[{}\/]/g, '_')}`);
    const params = [];
    for (const param of ep.params || []) {
      const pName = param.name || param.key || 'arg';
      const pIn = param.in || param.location || 'query';
      const pType = param.type
        ? (PRIMITIVE_MAP[param.type] || 'String')
        : param.schema ? schemaToKotlin(param.schema, {})
          : param.javaType ? (JAVA_TYPE_MAP[param.javaType] || param.javaType.replace(/^java\.lang\./, ''))
            : 'String';
      if (pIn === 'path') params.push(`        @Path("${pName}") ${toCamelCase(pName)}: ${pType}`);
      else if (pIn === 'query') params.push(`        @Query("${pName}") ${toCamelCase(pName)}: ${pType}${param.required === false ? '? = null' : ''}`);
      else if (pIn === 'body') {
        const bodyType = param.schema ? schemaToKotlin(param.schema, {}) : 'Any';
        if (param.schema?.$ref) dtoNames.add(param.schema.$ref.split('/').pop());
        params.push(`        @Body body: ${bodyType}`);
      }
    }
    let returnType = 'Unit';
    if (ep.response) {
      if (typeof ep.response === 'string') returnType = ep.response;
      else if (ep.response.$ref) {
        returnType = ep.response.$ref.split('/').pop();
        dtoNames.add(returnType);
      } else if (ep.response.type) returnType = schemaToKotlin(ep.response, {});
    }
    const wrapped = wrapper && returnType !== 'Unit' ? `${wrapper}<${returnType}>` : returnType;
    apiMethods.push(
      `    @${ep.method.toUpperCase()}("${ep.path}")\n` +
      `    suspend fun ${funcName}(${params.join(',\n' + ' '.repeat(8))}): ${wrapped}`
    );
  }

  // 生成文件
  const files = [];
  const annotationImport = serializer === 'kotlinx-serialization'
    ? 'import kotlinx.serialization.SerialName\n'
    : 'import com.squareup.moshi.Json\n';

  if (schemas.length > 0 || dtoNames.size > 0) {
    const dtoPath = `${namespace.replace(/\./g, '/')}/api/dto/Dtos.kt`;
    const body = schemas.map(s =>
      `@kotlin.annotation.Retention(AnnotationRetention.RUNTIME)\n`.length === 0
        ? ''
        : `/** ${s.name} */\n` +
          (serializer === 'kotlinx-serialization' ? '@kotlinx.serialization.Serializable\n' : '@JsonClass(generateAdapter = true)\n') +
          `data class ${s.name}(\n${s.code}\n)`
    ).join('\n\n');
    files.push({
      path: dtoPath,
      content:
        `// 由 pdd contract-bridge 生成，勿手工修改；重新生成: pdd contract -d .\n` +
        `package ${namespace}.api.dto\n\n` +
        (body.includes('@Json(name') || serializer === 'moshi' ? `${annotationImport}import com.squareup.moshi.JsonClass\n` : '') +
        `\n${body}\n`
    });
  }

  if (apiMethods.length > 0) {
    const usedDtos = [...dtoNames].filter(Boolean);
    const dtoImportsBlock = usedDtos.length
      ? usedDtos.map(d => `import ${namespace}.api.dto.${d}`).join('\n') + '\n' : '';
    files.push({
      path: `${namespace.replace(/\./g, '/')}/api/Apis.kt`,
      content:
        `// 由 pdd contract-bridge 生成，勿手工修改；重新生成: pdd contract -d .\n` +
        `package ${namespace}.api\n\n` +
        `import retrofit2.http.Body\nimport retrofit2.http.GET\nimport retrofit2.http.POST\nimport retrofit2.http.PUT\nimport retrofit2.http.DELETE\nimport retrofit2.http.PATCH\nimport retrofit2.http.Path\nimport retrofit2.http.Query\n` +
        dtoImportsBlock +
        `\ninterface Apis {\n\n${apiMethods.join(',\n\n')}\n}\n`
    });
  }

  return {
    files,
    summary: { dtos: schemas.length, endpoints: apiMethods.length }
  };
}

export default { generate };
