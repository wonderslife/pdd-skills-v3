#!/usr/bin/env python3
"""
API Endpoint Extractor for expert-testcases

Extracts API endpoints from Java Controller files and generates:
- API endpoint catalog (JSON)
- Permission matrix (JSON)
- API ID mapping

Usage:
    python extract_api.py --project <path> --module <module_name> --output <output_path>
"""
import argparse
import json
import re
from pathlib import Path
from typing import Dict, List


class ApiExtractor:
    API_ID_PREFIX = "A"
    HTTP_METHODS = {
        "GetMapping": "GET",
        "PostMapping": "POST",
        "PutMapping": "PUT",
        "DeleteMapping": "DELETE",
        "PatchMapping": "PATCH",
        "RequestMapping": "ANY",
    }

    def __init__(self, project_path: str, module_name: str):
        self.project_path = Path(project_path)
        self.module_name = module_name
        self.endpoints = []
        self.permission_matrix = {}

    def find_controllers(self) -> List[Path]:
        controllers = []
        for pattern in [f"**/{self.module_name}/**/controller/**/*.java",
                        f"**/{self.module_name}/**/*Controller.java"]:
            controllers.extend(self.project_path.glob(pattern))
        return list(set(controllers))

    def extract_from_file(self, file_path: Path) -> List[Dict]:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        class_mapping = self._get_class_mapping(content)
        endpoints = []

        for method_anno, http_method in self.HTTP_METHODS.items():
            if method_anno == "RequestMapping":
                continue
            pattern = rf'@{method_anno}\s*\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']'
            for match in re.finditer(pattern, content):
                path = match.group(1)
                full_path = f"{class_mapping}{path}".replace("//", "/")
                permission = self._find_permission(content, match.start())
                method_name = self._find_method_name(content, match.end())
                description = self._find_comment(content, match.start())
                consumes = self._find_consumes(content, match.start())

                endpoints.append({
                    "method": http_method,
                    "path": full_path,
                    "permission": permission,
                    "java_method": method_name,
                    "description": description or method_name,
                    "consumes": consumes,
                })

        req_pattern = r'@RequestMapping\s*\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']'
        for match in re.finditer(req_pattern, content):
            if "class" in content[max(0, match.start() - 100):match.start()]:
                continue
            path = match.group(1)
            full_path = f"{class_mapping}{path}".replace("//", "/")
            permission = self._find_permission(content, match.start())
            method_name = self._find_method_name(content, match.end())

            endpoints.append({
                "method": "ANY",
                "path": full_path,
                "permission": permission,
                "java_method": method_name,
                "description": method_name,
                "consumes": None,
            })

        return endpoints

    def _get_class_mapping(self, content: str) -> str:
        match = re.search(r'@RequestMapping\s*\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']', content)
        return match.group(1) if match else ""

    def _find_permission(self, content: str, pos: int) -> str:
        before = content[max(0, pos - 500):pos]
        match = re.search(r'@PreAuthorize\s*\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']', before)
        if match:
            return match.group(1)
        match = re.search(r'@RequiresPermissions\s*\(\s*["\']([^"\']+)["\']', before)
        return match.group(1) if match else ""

    def _find_method_name(self, content: str, pos: int) -> str:
        after = content[pos:pos + 200]
        match = re.search(r'public\s+\w+(?:<[^>]+>)?\s+(\w+)\s*\(', after)
        return match.group(1) if match else ""

    def _find_comment(self, content: str, pos: int) -> str:
        before = content[max(0, pos - 300):pos]
        lines = before.split('\n')
        comment_lines = []
        for line in reversed(lines):
            stripped = line.strip()
            if stripped.startswith('*') and not stripped.startswith('*/'):
                comment_lines.insert(0, stripped.lstrip('* '))
            elif stripped.startswith('/**'):
                break
            elif stripped == '*/':
                continue
            else:
                break
        return ' '.join(comment_lines).strip()

    def _find_consumes(self, content: str, pos: int) -> str:
        after = content[pos:pos + 200]
        match = re.search(r'consumes\s*=\s*["\']([^"\']+)["\']', after)
        return match.group(1) if match else "application/json"

    def assign_ids(self, endpoints: List[Dict]) -> List[Dict]:
        for i, ep in enumerate(endpoints, 1):
            ep["id"] = f"{self.API_ID_PREFIX}{i:03d}"
        return endpoints

    def build_permission_matrix(self, endpoints: List[Dict], roles: List[str]) -> Dict:
        matrix = {}
        for ep in endpoints:
            perm = ep.get("permission", "")
            matrix[ep["id"]] = {
                "endpoint": f"{ep['method']} {ep['path']}",
                "permission": perm,
                "roles": {role: self._check_permission(perm, role) for role in roles},
            }
        return matrix

    def _check_permission(self, permission: str, role: str) -> str:
        if not permission:
            return "unknown"
        if role == "admin":
            return "allowed"
        return "check_required"

    def run(self, roles: List[str] = None) -> Dict:
        controllers = self.find_controllers()
        all_endpoints = []

        for ctrl_file in controllers:
            endpoints = self.extract_from_file(ctrl_file)
            all_endpoints.extend(endpoints)

        all_endpoints.sort(key=lambda e: (e["method"], e["path"]))
        all_endpoints = self.assign_ids(all_endpoints)

        result = {
            "module": self.module_name,
            "total_endpoints": len(all_endpoints),
            "endpoints": all_endpoints,
        }

        if roles:
            result["permission_matrix"] = self.build_permission_matrix(all_endpoints, roles)

        return result


def main():
    parser = argparse.ArgumentParser(description="Extract API endpoints from Java controllers")
    parser.add_argument("--project", required=True, help="Project root path")
    parser.add_argument("--module", required=True, help="Module name")
    parser.add_argument("--roles", nargs="*", default=["applicant", "dept_manager", "leader", "admin", "cross_dept_user"],
                        help="Roles for permission matrix")
    parser.add_argument("--output", default="api_endpoints.json", help="Output file path")
    args = parser.parse_args()

    extractor = ApiExtractor(args.project, args.module)
    result = extractor.run(args.roles)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"API extraction complete:")
    print(f"  Endpoints found: {result['total_endpoints']}")
    for ep in result['endpoints']:
        print(f"  {ep['id']}: {ep['method']} {ep['path']} [{ep['permission']}]")
    print(f"  Output: {args.output}")


if __name__ == "__main__":
    main()
