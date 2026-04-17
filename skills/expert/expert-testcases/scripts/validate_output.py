#!/usr/bin/env python3
"""
Output Validator for expert-testcases

Validates generated test case artifacts:
- Python syntax check (py_compile)
- pytest collection check (--collect-only)
- YAML syntax check
- Markdown structure check
- Coverage estimation
- ID uniqueness check

Usage:
    python validate_output.py --output-dir <path> [--run-pytest] [--verbose]
"""
import argparse
import json
import os
import py_compile
import re
import sys
import yaml
from pathlib import Path
from typing import Dict, List, Tuple


class OutputValidator:
    def __init__(self, output_dir: str, verbose: bool = False):
        self.output_dir = Path(output_dir)
        self.verbose = verbose
        self.errors = []
        self.warnings = []
        self.stats = {
            "python_files": 0,
            "yaml_files": 0,
            "markdown_files": 0,
            "total_test_cases": 0,
            "total_pytest_functions": 0,
        }

    def validate_all(self) -> Dict:
        self._validate_directory_structure()
        self._validate_yaml_files()
        self._validate_python_files()
        self._validate_markdown_files()
        self._validate_test_case_ids()
        self._estimate_coverage()

        return {
            "valid": len(self.errors) == 0,
            "errors": self.errors,
            "warnings": self.warnings,
            "stats": self.stats,
        }

    def _validate_directory_structure(self):
        required_dirs = ["docs"]
        optional_dirs = ["01-api-testcases", "02-integration-testcases"]

        for d in required_dirs:
            if not (self.output_dir / d).exists():
                self.errors.append(f"Missing required directory: {d}/")

        for d in optional_dirs:
            if (self.output_dir / d).exists():
                self.stats[f"{d}_exists"] = True

        if not (self.output_dir / "test-data.yaml").exists():
            self.errors.append("Missing test-data.yaml")

    def _validate_yaml_files(self):
        for yaml_file in self.output_dir.glob("**/*.yaml"):
            self.stats["yaml_files"] += 1
            try:
                with open(yaml_file, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)

                if yaml_file.name == "test-data.yaml":
                    self._validate_test_data_yaml(data, yaml_file)

            except yaml.YAMLError as e:
                self.errors.append(f"YAML syntax error in {yaml_file}: {e}")

    def _validate_test_data_yaml(self, data: Dict, file_path: Path):
        required_sections = ["test_users", "apply_form_data", "status_codes"]
        for section in required_sections:
            if section not in data:
                self.warnings.append(f"test-data.yaml missing section: {section}")

        users = data.get("test_users", {})
        required_roles = ["applicant", "dept_manager", "leader", "admin", "cross_dept_user"]
        for role in required_roles:
            if role not in users:
                self.warnings.append(f"test-data.yaml missing role: {role}")
            else:
                user = users[role]
                for field in ["username", "password", "dept", "dept_id"]:
                    if field not in user:
                        self.errors.append(f"test-data.yaml user '{role}' missing field: {field}")

    def _validate_python_files(self):
        for py_file in self.output_dir.glob("**/*.py"):
            if "__pycache__" in str(py_file):
                continue
            self.stats["python_files"] += 1

            try:
                py_compile.compile(str(py_file), doraise=True)
            except py_compile.PyCompileError as e:
                self.errors.append(f"Python syntax error in {py_file.name}: {e}")

            content = py_file.read_text(encoding="utf-8", errors="ignore")
            test_functions = re.findall(r'def\s+(test_\w+)\s*\(', content)
            self.stats["total_pytest_functions"] += len(test_functions)

            if self.verbose:
                for func in test_functions:
                    print(f"  Found: {func} in {py_file.name}")

    def _validate_markdown_files(self):
        for md_file in self.output_dir.glob("docs/**/*.md"):
            self.stats["markdown_files"] += 1
            content = md_file.read_text(encoding="utf-8", errors="ignore")

            tc_ids = re.findall(r'TC-[\w-]+', content)
            self.stats["total_test_cases"] += len(tc_ids)

            if not content.startswith("#"):
                self.warnings.append(f"{md_file.name} does not start with a heading")

    def _validate_test_case_ids(self):
        all_ids = []
        for md_file in self.output_dir.glob("docs/**/*.md"):
            content = md_file.read_text(encoding="utf-8", errors="ignore")
            ids = re.findall(r'TC-[\w-]+', content)
            all_ids.extend(ids)

        if len(all_ids) != len(set(all_ids)):
            duplicates = [id for id in all_ids if all_ids.count(id) > 1]
            self.errors.append(f"Duplicate test case IDs: {set(duplicates)}")

    def _estimate_coverage(self):
        yaml_file = self.output_dir / "test-data.yaml"
        if not yaml_file.exists():
            return

        with open(yaml_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        endpoints = data.get("api_endpoints", {})
        total_endpoints = len(endpoints)

        if total_endpoints > 0:
            covered = sum(1 for ep in endpoints.values() if ep.get("tested", False))
            self.stats["api_endpoint_coverage"] = f"{covered}/{total_endpoints}"

        statuses = data.get("status_codes", {})
        total_statuses = len(statuses)
        if total_statuses > 0:
            self.stats["status_coverage"] = f"{total_statuses} statuses defined"

    def run_pytest_collect(self) -> Tuple[bool, int]:
        import subprocess
        for test_dir in ["01-api-testcases", "02-integration-testcases"]:
            test_path = self.output_dir / test_dir
            if not test_path.exists():
                continue

            try:
                result = subprocess.run(
                    ["python", "-m", "pytest", "--collect-only", "-q"],
                    cwd=str(test_path),
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if result.returncode != 0:
                    self.warnings.append(f"pytest collect failed in {test_dir}: {result.stderr}")
                else:
                    collected = result.stdout.count("test session starts")
                    if self.verbose:
                        print(f"  {test_dir}: pytest collection OK")
            except subprocess.TimeoutExpired:
                self.warnings.append(f"pytest collect timed out in {test_dir}")
            except FileNotFoundError:
                self.warnings.append(f"pytest not available for {test_dir}")

        return len(self.errors) == 0, self.stats.get("total_pytest_functions", 0)


def main():
    parser = argparse.ArgumentParser(description="Validate expert-testcases output")
    parser.add_argument("--output-dir", required=True, help="Output directory to validate")
    parser.add_argument("--run-pytest", action="store_true", help="Run pytest --collect-only")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    args = parser.parse_args()

    validator = OutputValidator(args.output_dir, args.verbose)
    result = validator.validate_all()

    if args.run_pytest:
        validator.run_pytest_collect()

    print(f"\n{'='*50}")
    print(f"Validation Result: {'PASS' if result['valid'] else 'FAIL'}")
    print(f"{'='*50}")
    print(f"Stats:")
    for k, v in result["stats"].items():
        print(f"  {k}: {v}")

    if result["errors"]:
        print(f"\nErrors ({len(result['errors'])}):")
        for e in result["errors"]:
            print(f"  ❌ {e}")

    if result["warnings"]:
        print(f"\nWarnings ({len(result['warnings'])}):")
        for w in result["warnings"]:
            print(f"  ⚠️ {w}")

    sys.exit(0 if result["valid"] else 1)


if __name__ == "__main__":
    main()
