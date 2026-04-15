"""
Seed Base Data - Initialize database with required base data

Usage:
    cd backend
    python -m scripts.seed_base_data

This script creates:
- 12 departments (multi-level org hierarchy)
- 5 test users (one per role)
- Common dictionary data (asset categories, disposal methods, evaluation methods)
- 3 sample assets (different categories)
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.database.database import async_session_factory, engine
from app.models.org import Org
from app.models.user import User
from app.models.role import Role
from app.models.dict_item import DictType, DictItem
from app.core.auth.security import get_password_hash


DEPARTMENTS = [
    {"name": "集团总部", "code": "HQ", "parent_id": None, "level": 1, "sort_order": 1},
    {"name": "华东分公司", "code": "HD", "parent_id": 1, "level": 2, "sort_order": 1},
    {"name": "华南分公司", "code": "HN", "parent_id": 1, "level": 2, "sort_order": 2},
    {"name": "综合管理部", "code": "ZHGL", "parent_id": 2, "level": 3, "sort_order": 1},
    {"name": "财务管理部", "code": "CWGL", "parent_id": 2, "level": 3, "sort_order": 2},
    {"name": "资产管理部", "code": "ZCGL", "parent_id": 2, "level": 3, "sort_order": 3},
    {"name": "评估业务部", "code": "PGYW", "parent_id": 2, "level": 3, "sort_order": 4},
    {"name": "处置业务部", "code": "CZYW", "parent_id": 2, "level": 3, "sort_order": 5},
    {"name": "综合管理部", "code": "HN_ZHGL", "parent_id": 3, "level": 3, "sort_order": 1},
    {"name": "财务管理部", "code": "HN_CWGL", "parent_id": 3, "level": 3, "sort_order": 2},
    {"name": "资产管理部", "code": "HN_ZCGL", "parent_id": 3, "level": 3, "sort_order": 3},
    {"name": "评估业务部", "code": "HN_PGYW", "parent_id": 3, "level": 3, "sort_order": 4},
]

ROLES = [
    {"name": "超级管理员", "code": "admin", "description": "系统最高权限"},
    {"name": "资产管理员", "code": "asset_manager", "description": "资产登记和管理"},
    {"name": "评估师", "code": "evaluator", "description": "资产评估执行"},
    {"name": "部门经理", "code": "dept_manager", "description": "审批和部门管理"},
    {"name": "分管领导", "code": "leader", "description": "高级审批"},
]

USERS = [
    {"username": "admin", "name": "系统管理员", "password": "admin123", "org_id": 1, "role_code": "admin", "is_superuser": True},
    {"username": "zhangsan", "name": "张三", "password": "123456", "org_id": 6, "role_code": "asset_manager"},
    {"username": "lisi", "name": "李四", "password": "123456", "org_id": 7, "role_code": "evaluator"},
    {"username": "wangwu", "name": "王五", "password": "123456", "org_id": 4, "role_code": "dept_manager"},
    {"username": "zhaoliu", "name": "赵六", "password": "123456", "org_id": 1, "role_code": "leader"},
]

DICT_TYPES = [
    {"code": "asset_category", "name": "资产类别", "sort_order": 1},
    {"code": "asset_status", "name": "资产状态", "sort_order": 2},
    {"code": "disposal_method", "name": "处置方式", "sort_order": 3},
    {"code": "evaluation_method", "name": "评估方法", "sort_order": 4},
    {"code": "approval_status", "name": "审批状态", "sort_order": 5},
]

DICT_ITEMS = {
    "asset_category": [
        {"label": "设备", "value": "equipment", "sort_order": 1},
        {"label": "车辆", "value": "vehicle", "sort_order": 2},
        {"label": "不动产", "value": "property", "sort_order": 3},
        {"label": "无形资产", "value": "intangible", "sort_order": 4},
    ],
    "asset_status": [
        {"label": "闲置", "value": "idle", "sort_order": 1},
        {"label": "评估中", "value": "evaluating", "sort_order": 2},
        {"label": "处置中", "value": "disposing", "sort_order": 3},
        {"label": "已处置", "value": "disposed", "sort_order": 4},
    ],
    "disposal_method": [
        {"label": "转让", "value": "transfer", "sort_order": 1},
        {"label": "报废", "value": "scrap", "sort_order": 2},
        {"label": "捐赠", "value": "donate", "sort_order": 3},
        {"label": "置换", "value": "exchange", "sort_order": 4},
    ],
    "evaluation_method": [
        {"label": "市场法", "value": "market", "sort_order": 1},
        {"label": "收益法", "value": "income", "sort_order": 2},
        {"label": "成本法", "value": "cost", "sort_order": 3},
    ],
    "approval_status": [
        {"label": "已提交", "value": "submitted", "sort_order": 1},
        {"label": "部门审批通过", "value": "dept_approved", "sort_order": 2},
        {"label": "领导审批中", "value": "leader_review", "sort_order": 3},
        {"label": "已通过", "value": "approved", "sort_order": 4},
        {"label": "已驳回", "value": "rejected", "sort_order": 5},
    ],
}


async def seed():
    async with async_session_factory() as session:
        print("=" * 60)
        print("  Seed Base Data - Initializing...")
        print("=" * 60)

        existing_orgs = (await session.execute(select(Org))).scalars().all()
        if existing_orgs:
            print(f"\n[SKIP] Departments already exist ({len(existing_orgs)} found)")
        else:
            for dept in DEPARTMENTS:
                org = Org(**dept, is_active=True)
                session.add(org)
            await session.flush()
            print(f"\n[OK] Created {len(DEPARTMENTS)} departments")

        existing_roles = (await session.execute(select(Role))).scalars().all()
        role_map = {r.code: r for r in existing_roles}
        if existing_roles:
            print(f"[SKIP] Roles already exist ({len(existing_roles)} found)")
        else:
            for role_data in ROLES:
                role = Role(**role_data)
                session.add(role)
            await session.flush()
            existing_roles = (await session.execute(select(Role))).scalars().all()
            role_map = {r.code: r for r in existing_roles}
            print(f"[OK] Created {len(ROLES)} roles")

        existing_users = (await session.execute(select(User))).scalars().all()
        if existing_users:
            print(f"[SKIP] Users already exist ({len(existing_users)} found)")
        else:
            for user_data in USERS:
                role_code = user_data.pop("role_code")
                user_data["password_hash"] = get_password_hash(user_data.pop("password"))
                user = User(**user_data)
                session.add(user)
            await session.flush()
            print(f"[OK] Created {len(USERS)} users")

        existing_dict_types = (await session.execute(select(DictType))).scalars().all()
        if existing_dict_types:
            print(f"[SKIP] Dict types already exist ({len(existing_dict_types)} found)")
        else:
            for dt_data in DICT_TYPES:
                dt = DictType(**dt_data, is_active=True)
                session.add(dt)
            await session.flush()

            existing_dict_types = (await session.execute(select(DictType))).scalars().all()
            dt_map = {dt.code: dt.id for dt in existing_dict_types}

            total_items = 0
            for dt_code, items in DICT_ITEMS.items():
                if dt_code in dt_map:
                    for item_data in items:
                        item = DictItem(dict_type_id=dt_map[dt_code], **item_data, is_active=True)
                        session.add(item)
                        total_items += 1
            print(f"[OK] Created {len(DICT_TYPES)} dict types with {total_items} items")

        await session.commit()
        print("\n" + "=" * 60)
        print("  Seed Complete!")
        print("=" * 60)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
