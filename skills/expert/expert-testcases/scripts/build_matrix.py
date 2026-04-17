#!/usr/bin/env python3
"""
Permission Matrix Builder for expert-testcases

Builds a Role × Operation permission matrix from:
- @PreAuthorize annotations
- @RequiresPermissions annotations
- @DataScope annotations
- Role definitions in SQL/config

Usage:
    python build_matrix.py --analysis <path> --roles <role_list> --output <output_path>
"""
import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Optional


class PermissionMatrixBuilder:
    def __init__(self, analysis_path: str):
        self.analysis_path = Path(analysis_path)
        self.matrix = {}
        self.datascope_info = {}

    def load_analysis(self) -> Dict:
        if self.analysis_path.suffix == ".json":
            with open(self.analysis_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def parse_permission_string(self, perm: str) -> Dict:
        parts = perm.split(":")
        return {
            "raw": perm,
            "module": parts[0] if len(parts) > 0 else "",
            "entity": parts[1] if len(parts) > 1 else "",
            "action": parts[2] if len(parts) > 2 else "",
            "sub_action": parts[3] if len(parts) > 3 else "",
        }

    def build_role_permissions(self, sql_path: Optional[str] = None) -> Dict[str, List[str]]:
        role_perms = {}
        if sql_path and Path(sql_path).exists():
            content = Path(sql_path).read_text(encoding="utf-8", errors="ignore")
            pattern = r"INSERT\s+INTO\s+sys_role_menu.*?VALUES\s*\((\d+),\s*(\d+)\)"
            role_menu_map = {}
            for match in re.finditer(pattern, content, re.IGNORECASE):
                role_id = match.group(1)
                menu_id = match.group(2)
                role_menu_map.setdefault(role_id, []).append(menu_id)

            menu_perms = {}
            perm_pattern = r"INSERT\s+INTO\s+sys_menu.*?VALUES\s*\((\d+),.*?'([^']*)'"
            for match in re.finditer(perm_pattern, content, re.IGNORECASE):
                menu_id = match.group(1)
                perm = match.group(2)
                if perm and ":" in perm:
                    menu_perms[menu_id] = perm

            for role_id, menu_ids in role_menu_map.items():
                perms = [menu_perms[mid] for mid in menu_ids if mid in menu_perms]
                role_perms[f"role_{role_id}"] = perms

        return role_perms

    def build_matrix(self, endpoints: List[Dict], roles: Dict[str, List[str]]) -> Dict:
        matrix = {}
        for ep in endpoints:
            ep_id = ep.get("id", "")
            perm = ep.get("permission", "")
            perm_parsed = self.parse_permission_string(perm) if perm else {}

            role_access = {}
            for role_name, role_perms in roles.items():
                if not perm:
                    role_access[role_name] = "unknown"
                elif role_name == "admin":
                    role_access[role_name] = "allowed"
                elif perm in role_perms:
                    role_access[role_name] = "allowed"
                else:
                    role_access[role_name] = "denied"

            matrix[ep_id] = {
                "endpoint": f"{ep.get('method', '')} {ep.get('path', '')}",
                "permission": perm,
                "permission_parsed": perm_parsed,
                "role_access": role_access,
            }

        return matrix

    def detect_datascope(self, project_path: str, module_name: str) -> List[Dict]:
        datascope_findings = []
        project = Path(project_path)

        for java_file in project.glob(f"**/{module_name}/**/*.java"):
            content = java_file.read_text(encoding="utf-8", errors="ignore")
            if "@DataScope" in content:
                match = re.search(r'@DataScope\(([^)]+)\)', content)
                if match:
                    datascope_findings.append({
                        "file": str(java_file.relative_to(project)),
                        "annotation": match.group(0),
                        "params": match.group(1),
                    })

            if "dept_id" in content.lower() and "select" in content.lower():
                if "@DataScope" not in content:
                    datascope_findings.append({
                        "file": str(java_file.relative_to(project)),
                        "annotation": None,
                        "warning": "Uses dept_id in query but missing @DataScope annotation",
                        "risk": "PATTERN-R013",
                    })

        return datascope_findings

    def generate_test_scenarios(self, matrix: Dict) -> List[Dict]:
        scenarios = []
        for ep_id, info in matrix.items():
            for role, access in info.get("role_access", {}).items():
                if access == "allowed":
                    scenarios.append({
                        "test_type": "positive",
                        "endpoint_id": ep_id,
                        "role": role,
                        "expected": 200,
                        "description": f"{role} can access {info['endpoint']}",
                    })
                elif access == "denied":
                    scenarios.append({
                        "test_type": "negative",
                        "endpoint_id": ep_id,
                        "role": role,
                        "expected": 403,
                        "description": f"{role} denied access to {info['endpoint']}",
                    })
        return scenarios


def main():
    parser = argparse.ArgumentParser(description="Build permission matrix for test case generation")
    parser.add_argument("--analysis", required=True, help="Path to analysis result JSON")
    parser.add_argument("--sql", help="Path to SQL file with role-menu mappings")
    parser.add_argument("--project", help="Project root path for @DataScope detection")
    parser.add_argument("--module", help="Module name for @DataScope detection")
    parser.add_argument("--output", default="permission_matrix.json", help="Output file path")
    args = parser.parse_args()

    builder = PermissionMatrixBuilder(args.analysis)
    analysis = builder.load_analysis()
    endpoints = analysis.get("endpoints", [])

    role_perms = builder.build_role_permissions(args.sql)
    if not role_perms:
        role_perms = {
            "applicant": [],
            "dept_manager": [],
            "leader": [],
            "admin": ["*"],
            "cross_dept_user": [],
        }

    matrix = builder.build_matrix(endpoints, role_perms)
    scenarios = builder.generate_test_scenarios(matrix)

    result = {
        "permission_matrix": matrix,
        "test_scenarios": scenarios,
        "scenario_count": len(scenarios),
    }

    if args.project and args.module:
        datascope = builder.detect_datascope(args.project, args.module)
        result["datascope_findings"] = datascope

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Permission matrix built:")
    print(f"  Endpoints: {len(matrix)}")
    print(f"  Test scenarios: {len(scenarios)}")
    if result.get("datascope_findings"):
        print(f"  @DataScope findings: {len(result['datascope_findings'])}")
    print(f"  Output: {args.output}")


if __name__ == "__main__":
    main()
