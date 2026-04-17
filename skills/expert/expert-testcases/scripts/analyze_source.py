#!/usr/bin/env python3
"""
Source Code Analyzer for expert-testcases

Analyzes Java source code to extract:
- Controller endpoints (API contract)
- Service method signatures
- Domain entity fields
- Status code definitions
- Permission annotations
- Workflow process definitions

Usage:
    python analyze_source.py --project <path> --module <module_name> --output <output_path>
"""
import argparse
import json
import os
import re
from pathlib import Path
from typing import Dict, List, Optional


class SourceAnalyzer:
    def __init__(self, project_path: str, module_name: str):
        self.project_path = Path(project_path)
        self.module_name = module_name
        self.results = {
            "module": module_name,
            "controllers": [],
            "services": [],
            "entities": [],
            "enums": [],
            "mappers": [],
        }

    def find_java_files(self, subdir: str = "") -> List[Path]:
        pattern = f"**/{self.module_name}/**/*.java"
        if subdir:
            pattern = f"**/{self.module_name}/**/{subdir}/**/*.java"
        return list(self.project_path.glob(pattern))

    def analyze_controller(self, file_path: Path) -> Dict:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        controller = {
            "file": str(file_path.relative_to(self.project_path)),
            "class_name": self._extract_class_name(content),
            "base_path": self._extract_class_mapping(content),
            "endpoints": self._extract_endpoints(content),
        }
        return controller

    def analyze_service(self, file_path: Path) -> Dict:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        service = {
            "file": str(file_path.relative_to(self.project_path)),
            "class_name": self._extract_class_name(content),
            "methods": self._extract_service_methods(content),
        }
        return service

    def analyze_entity(self, file_path: Path) -> Dict:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        entity = {
            "file": str(file_path.relative_to(self.project_path)),
            "class_name": self._extract_class_name(content),
            "fields": self._extract_entity_fields(content),
            "table_name": self._extract_table_name(content),
        }
        return entity

    def _extract_class_name(self, content: str) -> str:
        match = re.search(r'public\s+(?:class|interface)\s+(\w+)', content)
        return match.group(1) if match else ""

    def _extract_class_mapping(self, content: str) -> str:
        match = re.search(r'@RequestMapping\s*\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']', content)
        return match.group(1) if match else ""

    def _extract_endpoints(self, content: str) -> List[Dict]:
        endpoints = []
        patterns = [
            (r'@GetMapping\s*\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']', "GET"),
            (r'@PostMapping\s*\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']', "POST"),
            (r'@PutMapping\s*\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']', "PUT"),
            (r'@DeleteMapping\s*\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']', "DELETE"),
            (r'@PatchMapping\s*\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']', "PATCH"),
        ]
        for pattern, method in patterns:
            for match in re.finditer(pattern, content):
                path = match.group(1)
                permission = self._extract_nearby_permission(content, match.start())
                desc = self._extract_nearby_comment(content, match.start())
                endpoints.append({
                    "method": method,
                    "path": path,
                    "permission": permission,
                    "description": desc,
                })
        return endpoints

    def _extract_nearby_permission(self, content: str, pos: int) -> str:
        before = content[max(0, pos - 500):pos]
        match = re.search(r'@PreAuthorize\s*\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']', before)
        return match.group(1) if match else ""

    def _extract_nearby_comment(self, content: str, pos: int) -> str:
        before = content[max(0, pos - 300):pos]
        match = re.search(r'/\*\*\s*\*\s*(.+?)\s*\*/', before, re.DOTALL)
        if match:
            return match.group(1).strip()
        return ""

    def _extract_service_methods(self, content: str) -> List[Dict]:
        methods = []
        pattern = r'public\s+(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)'
        for match in re.finditer(pattern, content):
            methods.append({
                "return_type": match.group(1),
                "name": match.group(2),
                "params": match.group(3).strip(),
            })
        return methods

    def _extract_entity_fields(self, content: str) -> List[Dict]:
        fields = []
        pattern = r'private\s+(\w+(?:<[^>]+>)?)\s+(\w+)\s*;'
        for match in re.finditer(pattern, content):
            fields.append({
                "type": match.group(1),
                "name": match.group(2),
            })
        return fields

    def _extract_table_name(self, content: str) -> str:
        match = re.search(r'@TableName\s*\(\s*["\']([^"\']+)["\']', content)
        if match:
            return match.group(1)
        match = re.search(r'@Table\s*\(\s*name\s*=\s*["\']([^"\']+)["\']', content)
        return match.group(1) if match else ""

    def run(self) -> Dict:
        for java_file in self.find_java_files("controller"):
            self.results["controllers"].append(self.analyze_controller(java_file))

        for java_file in self.find_java_files("service"):
            self.results["services"].append(self.analyze_service(java_file))

        for java_file in self.find_java_files("domain"):
            self.results["entities"].append(self.analyze_entity(java_file))

        return self.results


def main():
    parser = argparse.ArgumentParser(description="Analyze Java source code for test case generation")
    parser.add_argument("--project", required=True, help="Project root path")
    parser.add_argument("--module", required=True, help="Module name (e.g., equity-transfer)")
    parser.add_argument("--output", default="analysis_result.json", help="Output file path")
    args = parser.parse_args()

    analyzer = SourceAnalyzer(args.project, args.module)
    results = analyzer.run()

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"Analysis complete. Found:")
    print(f"  Controllers: {len(results['controllers'])}")
    print(f"  Services: {len(results['services'])}")
    print(f"  Entities: {len(results['entities'])}")
    total_endpoints = sum(len(c['endpoints']) for c in results['controllers'])
    print(f"  Total API endpoints: {total_endpoints}")
    print(f"  Output: {args.output}")


if __name__ == "__main__":
    main()
