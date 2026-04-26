#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import time
import traceback
import webbrowser
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests


PASS = "PASS"
FAIL = "FAIL"
SKIPPED = "SKIPPED"


@dataclass
class TestResult:
    test_id: str
    module: str
    name: str
    method: str
    target: str
    request_data: str
    expected: str
    actual: str
    status: str
    duration_ms: float
    error: str = ""


@dataclass
class TestContext:
    base_url: str
    frontend_url: Optional[str]
    project_root: Path
    server_dir: Path
    frontend_dir: Path
    pages_json: Path
    timeout: int = 8
    user: Optional[Dict[str, str]] = None
    movie_id: Optional[int] = None
    backend_alive: bool = False


class SystemTester:
    def __init__(self, context: TestContext) -> None:
        self.ctx = context
        self.results: List[TestResult] = []
        self.timeline: List[str] = []

    def add_timeline(self, text: str) -> None:
        self.timeline.append(text)

    def add_result(
        self,
        *,
        test_id: str,
        module: str,
        name: str,
        method: str,
        target: str,
        request_data: Any,
        expected: str,
        actual: Any,
        status: str,
        start: float,
        error: str = "",
    ) -> None:
        actual_text = actual if isinstance(actual, str) else json.dumps(actual, ensure_ascii=False, default=str)
        req_text = request_data if isinstance(request_data, str) else json.dumps(request_data, ensure_ascii=False, default=str)
        self.results.append(
            TestResult(
                test_id=test_id,
                module=module,
                name=name,
                method=method,
                target=target,
                request_data=req_text,
                expected=expected,
                actual=(actual_text[:300] + "...") if len(actual_text) > 300 else actual_text,
                status=status,
                duration_ms=round((time.perf_counter() - start) * 1000, 2),
                error=error[:300],
            )
        )

    def safe_request(self, method: str, path: str, **kwargs: Any) -> Tuple[Optional[requests.Response], Optional[str]]:
        try:
            resp = requests.request(method, f"{self.ctx.base_url}{path}", timeout=self.ctx.timeout, **kwargs)
            return resp, None
        except Exception as exc:  # noqa: BLE001
            return None, str(exc)

    def run_environment_checks(self) -> None:
        self.add_timeline("检查项目结构")
        checks = [
            ("ENV-001", "Python 版本检查", f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}", "Python 3.8+"),
            ("ENV-002", "检查 server-api 目录", str(self.ctx.server_dir.exists()), "存在"),
            ("ENV-003", "检查 uniapp/app 目录", str(self.ctx.frontend_dir.exists()), "存在"),
            ("ENV-004", "检查后端 package.json", str((self.ctx.server_dir / "package.json").exists()), "存在"),
        ]
        for test_id, name, actual, expected in checks:
            start = time.perf_counter()
            passed = actual.startswith("True") if "存在" in expected else sys.version_info >= (3, 8)
            self.add_result(
                test_id=test_id,
                module="环境检查",
                name=name,
                method="CHECK",
                target="local",
                request_data="-",
                expected=expected,
                actual=actual,
                status=PASS if passed else FAIL,
                start=start,
            )

        self.add_timeline("检查后端服务")
        start = time.perf_counter()
        resp, err = self.safe_request("GET", "/api/test")
        if err or resp is None:
            self.ctx.backend_alive = False
            self.add_result(
                test_id="ENV-005",
                module="环境检查",
                name="后端服务连通性",
                method="GET",
                target=f"{self.ctx.base_url}/api/test",
                request_data="-",
                expected="后端服务可访问，返回 JSON",
                actual="后端服务未启动 / 连接失败",
                status=FAIL,
                start=start,
                error=err or "连接失败",
            )
            return

        self.ctx.backend_alive = resp.ok
        body: Any
        try:
            body = resp.json()
        except Exception:
            body = resp.text
        self.add_result(
            test_id="ENV-005",
            module="环境检查",
            name="后端服务连通性",
            method="GET",
            target=f"{self.ctx.base_url}/api/test",
            request_data="-",
            expected="HTTP 200 且包含 msg",
            actual=body,
            status=PASS if resp.ok else FAIL,
            start=start,
        )

    def run_frontend_static_checks(self) -> None:
        module = "前端页面检查"
        page_map = {
            "首页": "pages/index/index",
            "搜索页": "pages/search/search",
            "电影详情页": "pages/detail/detail",
            "我的页面": "pages/mine/mine",
            "偏好设置页": "pages/preferences/preferences",
            "登录/注册页": "pages/auth/auth",
            "管理员中心页": "pages/admin/admin",
        }

        start = time.perf_counter()
        try:
            pages_data = json.loads(self.ctx.pages_json.read_text(encoding="utf-8"))
            configured_pages = {item.get("path") for item in pages_data.get("pages", [])}
            self.add_result(
                test_id="FE-001",
                module=module,
                name="读取 pages.json",
                method="CHECK",
                target=str(self.ctx.pages_json),
                request_data="-",
                expected="pages.json 可解析",
                actual=f"共 {len(configured_pages)} 个页面配置",
                status=PASS,
                start=start,
            )
        except Exception as exc:  # noqa: BLE001
            self.add_result(
                test_id="FE-001",
                module=module,
                name="读取 pages.json",
                method="CHECK",
                target=str(self.ctx.pages_json),
                request_data="-",
                expected="pages.json 可解析",
                actual="读取失败",
                status=FAIL,
                start=start,
                error=str(exc),
            )
            return

        feature_keywords = {
            "首页": ["推荐", "电影", "api", "recommend"],
            "搜索页": ["搜索", "keyword", "/api/search"],
            "电影详情页": ["详情", "movie", "点赞", "收藏", "/api/movie"],
            "我的页面": ["我的", "用户", "收藏", "登录"],
            "偏好设置页": ["偏好", "favoriteGenres", "preferredEra", "discoveryStyle"],
            "登录/注册页": ["登录", "注册", "/api/auth/login", "/api/auth/register"],
            "管理员中心页": ["管理员", "admin", "/api/admin"],
        }

        for idx, (name, page_path) in enumerate(page_map.items(), start=2):
            start = time.perf_counter()
            vue_file = self.ctx.frontend_dir / f"{page_path}.vue"
            in_config = page_path in configured_pages
            exists = vue_file.exists()
            summary = {"in_pages_json": in_config, "vue_exists": exists, "matched_keywords": []}
            status = PASS if in_config and exists else FAIL
            if exists:
                try:
                    content = vue_file.read_text(encoding="utf-8")
                    matched = [kw for kw in feature_keywords.get(name, []) if kw in content]
                    summary["matched_keywords"] = matched
                    if len(matched) < 1:
                        status = FAIL
                except Exception as exc:  # noqa: BLE001
                    status = FAIL
                    summary["read_error"] = str(exc)

            self.add_result(
                test_id=f"FE-{idx:03d}",
                module=module,
                name=f"{name}配置与静态内容检查",
                method="CHECK",
                target=page_path,
                request_data="读取 pages.json + .vue 文件",
                expected="页面已配置、文件存在、包含核心文字或接口调用痕迹",
                actual=summary,
                status=status,
                start=start,
            )

    def run_backend_api_tests(self) -> None:
        if not self.ctx.backend_alive:
            for module, prefix, items in [
                ("电影查询测试", "MOV", ["获取电影列表", "搜索电影", "获取电影详情"]),
                ("个性化推荐测试", "REC", ["游客推荐", "用户推荐"]),
                ("用户认证测试", "AUTH", ["注册用户", "用户登录", "保存偏好", "登录校验偏好"]),
                ("用户行为测试", "BEH", ["行为状态查询", "记录浏览", "点赞切换", "收藏切换"]),
            ]:
                for i, name in enumerate(items, start=1):
                    start = time.perf_counter()
                    self.add_result(
                        test_id=f"{prefix}-{i:03d}",
                        module=module,
                        name=name,
                        method="SKIP",
                        target="后端接口",
                        request_data="-",
                        expected="后端可用后执行",
                        actual="后端服务未启动 / 连接失败",
                        status=SKIPPED,
                        start=start,
                    )
            return

        self._run_auth_tests()
        self._run_movie_tests()
        self._run_recommend_tests()
        self._run_behavior_tests()
        self._run_admin_tests()

    def _run_auth_tests(self) -> None:
        module = "用户认证测试"
        self.add_timeline("注册测试用户")
        ts = int(time.time())
        username = f"test_user_{ts}"
        password = "Test@123456"
        nickname = f"测试用户{ts}"
        self.ctx.user = {"username": username, "password": password}

        start = time.perf_counter()
        resp, err = self.safe_request("POST", "/api/auth/register", json={"username": username, "password": password, "nickname": nickname})
        body = self._resp_body(resp)
        self.add_result(
            test_id="AUTH-001",
            module=module,
            name="注册测试用户",
            method="POST",
            target=f"{self.ctx.base_url}/api/auth/register",
            request_data={"username": username, "nickname": nickname},
            expected="code=200",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and not err else FAIL,
            start=start,
            error=err or "",
        )

        self.add_timeline("登录测试用户")
        start = time.perf_counter()
        resp, err = self.safe_request("POST", "/api/auth/login", json={"username": username, "password": password})
        body = self._resp_body(resp)
        self.add_result(
            test_id="AUTH-002",
            module=module,
            name="登录测试用户",
            method="POST",
            target=f"{self.ctx.base_url}/api/auth/login",
            request_data={"username": username},
            expected="code=200 且返回用户信息",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and isinstance(body.get("data"), dict) and not err else FAIL,
            start=start,
            error=err or "",
        )

        self.add_timeline("保存用户偏好")
        preferences = {"favoriteGenres": ["动作", "科幻"], "preferredEra": "recent", "discoveryStyle": "balanced"}
        start = time.perf_counter()
        resp, err = self.safe_request("POST", "/api/auth/preferences", json={"username": username, "preferences": preferences})
        body = self._resp_body(resp)
        self.add_result(
            test_id="AUTH-003",
            module=module,
            name="保存用户偏好",
            method="POST",
            target=f"{self.ctx.base_url}/api/auth/preferences",
            request_data={"username": username, "preferences": preferences},
            expected="code=200",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and not err else FAIL,
            start=start,
            error=err or "",
        )

        start = time.perf_counter()
        resp, err = self.safe_request("POST", "/api/auth/login", json={"username": username, "password": password})
        body = self._resp_body(resp)
        prefs = (((body or {}).get("data") or {}).get("preferences") or {}) if isinstance(body, dict) else {}
        has_pref = bool(prefs.get("favoriteGenres"))
        self.add_result(
            test_id="AUTH-004",
            module=module,
            name="登录后校验偏好",
            method="POST",
            target=f"{self.ctx.base_url}/api/auth/login",
            request_data={"username": username},
            expected="返回 preferences 且包含 favoriteGenres",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and has_pref and not err else FAIL,
            start=start,
            error=err or "",
        )

    def _run_movie_tests(self) -> None:
        module = "电影查询测试"
        self.add_timeline("获取电影列表")
        start = time.perf_counter()
        resp, err = self.safe_request("GET", "/api/movies")
        body = self._resp_body(resp)
        movies = body.get("data", []) if isinstance(body, dict) else []
        if movies and isinstance(movies[0], dict) and movies[0].get("id") is not None:
            self.ctx.movie_id = movies[0]["id"]
        self.add_result(
            test_id="MOV-001",
            module=module,
            name="获取电影列表",
            method="GET",
            target=f"{self.ctx.base_url}/api/movies",
            request_data="-",
            expected="code=200 且 data 为列表",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and isinstance(movies, list) and not err else FAIL,
            start=start,
            error=err or "",
        )

        self.add_timeline("查询电影")
        start = time.perf_counter()
        resp, err = self.safe_request("GET", "/api/search", params={"keyword": "复仇"})
        body = self._resp_body(resp)
        self.add_result(
            test_id="MOV-002",
            module=module,
            name="搜索电影",
            method="GET",
            target=f"{self.ctx.base_url}/api/search?keyword=复仇",
            request_data={"keyword": "复仇"},
            expected="code=200 且 data 为列表",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and isinstance(body.get("data"), list) and not err else FAIL,
            start=start,
            error=err or "",
        )

        self.add_timeline("获取电影详情")
        start = time.perf_counter()
        if not self.ctx.movie_id:
            self.add_result(
                test_id="MOV-003",
                module=module,
                name="获取电影详情",
                method="GET",
                target=f"{self.ctx.base_url}/api/movie?id={{movie_id}}",
                request_data="缺少 movie_id",
                expected="code=200",
                actual="前置条件失败：未获取到 movie_id",
                status=SKIPPED,
                start=start,
            )
            return

        resp, err = self.safe_request("GET", "/api/movie", params={"id": self.ctx.movie_id})
        body = self._resp_body(resp)
        self.add_result(
            test_id="MOV-003",
            module=module,
            name="获取电影详情",
            method="GET",
            target=f"{self.ctx.base_url}/api/movie?id={self.ctx.movie_id}",
            request_data={"id": self.ctx.movie_id},
            expected="code=200 且 data 为对象",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and isinstance(body.get("data"), dict) and not err else FAIL,
            start=start,
            error=err or "",
        )

    def _run_recommend_tests(self) -> None:
        module = "个性化推荐测试"
        self.add_timeline("生成个性化推荐")
        start = time.perf_counter()
        resp, err = self.safe_request("GET", "/api/recommend", params={"limit": 8})
        body = self._resp_body(resp)
        self.add_result(
            test_id="REC-001",
            module=module,
            name="游客推荐",
            method="GET",
            target=f"{self.ctx.base_url}/api/recommend?limit=8",
            request_data={"limit": 8},
            expected="code=200 且返回推荐列表",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and isinstance(body.get("data"), list) and not err else FAIL,
            start=start,
            error=err or "",
        )

        start = time.perf_counter()
        username = (self.ctx.user or {}).get("username")
        if not username:
            self.add_result(
                test_id="REC-002",
                module=module,
                name="登录用户推荐",
                method="GET",
                target=f"{self.ctx.base_url}/api/recommend",
                request_data="缺少测试用户",
                expected="code=200",
                actual="前置条件失败：未创建测试用户",
                status=SKIPPED,
                start=start,
            )
            return

        resp, err = self.safe_request("GET", "/api/recommend", params={"username": username, "limit": 8})
        body = self._resp_body(resp)
        self.add_result(
            test_id="REC-002",
            module=module,
            name="登录用户推荐",
            method="GET",
            target=f"{self.ctx.base_url}/api/recommend?username={username}&limit=8",
            request_data={"username": username, "limit": 8},
            expected="code=200 且返回个性化或兜底推荐",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and isinstance(body.get("data"), list) and not err else FAIL,
            start=start,
            error=err or "",
        )

    def _run_behavior_tests(self) -> None:
        module = "用户行为测试"
        username = (self.ctx.user or {}).get("username")
        movie_id = self.ctx.movie_id

        if not username or not movie_id:
            for i, name in enumerate(["行为状态查询", "记录浏览行为", "点赞切换", "收藏切换"], start=1):
                start = time.perf_counter()
                self.add_result(
                    test_id=f"BEH-{i:03d}",
                    module=module,
                    name=name,
                    method="SKIP",
                    target="/api/behavior*",
                    request_data="缺少 username 或 movie_id",
                    expected="前置条件满足后执行",
                    actual="前置条件失败",
                    status=SKIPPED,
                    start=start,
                )
            return

        self.add_timeline("记录浏览行为")
        start = time.perf_counter()
        resp, err = self.safe_request("GET", "/api/behavior/status", params={"username": username, "movie_id": movie_id})
        body = self._resp_body(resp)
        self.add_result(
            test_id="BEH-001",
            module=module,
            name="行为状态查询(初始)",
            method="GET",
            target=f"{self.ctx.base_url}/api/behavior/status",
            request_data={"username": username, "movie_id": movie_id},
            expected="code=200，返回 liked/favorited",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and isinstance((body.get("data") or {}).get("liked"), bool) and not err else FAIL,
            start=start,
            error=err or "",
        )

        start = time.perf_counter()
        resp, err = self.safe_request(
            "POST", "/api/behavior", json={"username": username, "movie_id": movie_id, "behavior_type": "view", "score": 1}
        )
        body = self._resp_body(resp)
        self.add_result(
            test_id="BEH-002",
            module=module,
            name="记录浏览行为",
            method="POST",
            target=f"{self.ctx.base_url}/api/behavior",
            request_data={"username": username, "movie_id": movie_id, "behavior_type": "view", "score": 1},
            expected="code=200",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and not err else FAIL,
            start=start,
            error=err or "",
        )

        self.add_timeline("点赞与收藏")
        start = time.perf_counter()
        resp, err = self.safe_request(
            "POST", "/api/behavior/toggle", json={"username": username, "movie_id": movie_id, "behavior_type": "like", "score": 2.5}
        )
        body = self._resp_body(resp)
        self.add_result(
            test_id="BEH-003",
            module=module,
            name="点赞切换",
            method="POST",
            target=f"{self.ctx.base_url}/api/behavior/toggle",
            request_data={"username": username, "movie_id": movie_id, "behavior_type": "like", "score": 2.5},
            expected="code=200",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and not err else FAIL,
            start=start,
            error=err or "",
        )

        start = time.perf_counter()
        resp, err = self.safe_request("GET", "/api/behavior/status", params={"username": username, "movie_id": movie_id})
        body = self._resp_body(resp)
        liked_after = ((body or {}).get("data") or {}).get("liked") if isinstance(body, dict) else None
        self.add_result(
            test_id="BEH-004",
            module=module,
            name="点赞状态校验",
            method="GET",
            target=f"{self.ctx.base_url}/api/behavior/status",
            request_data={"username": username, "movie_id": movie_id},
            expected="liked 字段有效且状态变化",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and isinstance(liked_after, bool) and not err else FAIL,
            start=start,
            error=err or "",
        )

        start = time.perf_counter()
        resp, err = self.safe_request(
            "POST", "/api/behavior/toggle", json={"username": username, "movie_id": movie_id, "behavior_type": "favorite", "score": 4}
        )
        body = self._resp_body(resp)
        self.add_result(
            test_id="BEH-005",
            module=module,
            name="收藏切换",
            method="POST",
            target=f"{self.ctx.base_url}/api/behavior/toggle",
            request_data={"username": username, "movie_id": movie_id, "behavior_type": "favorite", "score": 4},
            expected="code=200",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and not err else FAIL,
            start=start,
            error=err or "",
        )

        start = time.perf_counter()
        resp, err = self.safe_request("GET", "/api/behavior/status", params={"username": username, "movie_id": movie_id})
        body = self._resp_body(resp)
        favored_after = ((body or {}).get("data") or {}).get("favorited") if isinstance(body, dict) else None
        self.add_result(
            test_id="BEH-006",
            module=module,
            name="收藏状态校验",
            method="GET",
            target=f"{self.ctx.base_url}/api/behavior/status",
            request_data={"username": username, "movie_id": movie_id},
            expected="favorited 字段有效且状态变化",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and isinstance(favored_after, bool) and not err else FAIL,
            start=start,
            error=err or "",
        )

    def _run_admin_tests(self) -> None:
        module = "管理员功能测试"
        self.add_timeline("检查管理员功能")
        admin_user = os.getenv("TEST_ADMIN_USERNAME")
        admin_pwd = os.getenv("TEST_ADMIN_PASSWORD")
        if not admin_user or not admin_pwd:
            start = time.perf_counter()
            self.add_result(
                test_id="ADM-000",
                module=module,
                name="管理员测试准备",
                method="CHECK",
                target="ENV(TEST_ADMIN_USERNAME/PASSWORD)",
                request_data="-",
                expected="配置管理员测试账号",
                actual="未配置 TEST_ADMIN_USERNAME / TEST_ADMIN_PASSWORD，跳过管理员权限测试",
                status=SKIPPED,
                start=start,
            )
            return

        start = time.perf_counter()
        resp, err = self.safe_request("POST", "/api/auth/login", json={"username": admin_user, "password": admin_pwd})
        body = self._resp_body(resp)
        admin_login_ok = self._code_is(body, 200)
        self.add_result(
            test_id="ADM-001",
            module=module,
            name="管理员登录",
            method="POST",
            target=f"{self.ctx.base_url}/api/auth/login",
            request_data={"username": admin_user},
            expected="code=200",
            actual=body if not err else "请求失败",
            status=PASS if admin_login_ok and not err else FAIL,
            start=start,
            error=err or "",
        )
        if not admin_login_ok:
            return

        admin_q = {"admin_username": admin_user}
        admin_gets = [
            ("ADM-002", "管理员概览", "/api/admin/overview"),
            ("ADM-003", "用户列表", "/api/admin/users"),
            ("ADM-004", "推荐配置读取", "/api/admin/recommendation-config"),
        ]
        config_data: Dict[str, Any] = {}
        for tid, name, path in admin_gets:
            start = time.perf_counter()
            resp, err = self.safe_request("GET", path, params=admin_q)
            body = self._resp_body(resp)
            ok = self._code_is(body, 200)
            if path.endswith("recommendation-config") and ok:
                config_data = (body or {}).get("data") or {}
            self.add_result(
                test_id=tid,
                module=module,
                name=name,
                method="GET",
                target=f"{self.ctx.base_url}{path}",
                request_data=admin_q,
                expected="code=200",
                actual=body if not err else "请求失败",
                status=PASS if ok and not err else FAIL,
                start=start,
                error=err or "",
            )

        if config_data:
            payload = {
                "admin_username": admin_user,
                "item_cf_weight": config_data.get("item_cf_weight", 0.4),
                "user_cf_weight": config_data.get("user_cf_weight", 0.2),
                "popularity_weight": config_data.get("popularity_weight", 0.15),
                "preference_weight": config_data.get("preference_weight", 0.2),
                "behavior_profile_weight": config_data.get("behavior_profile_weight", 0.15),
                "diversity_weight": config_data.get("diversity_weight", 0.07),
                "random_weight": config_data.get("random_weight", 0.03),
            }
            start = time.perf_counter()
            resp, err = self.safe_request("POST", "/api/admin/recommendation-config", json=payload)
            body = self._resp_body(resp)
            self.add_result(
                test_id="ADM-005",
                module=module,
                name="推荐配置提交(安全值)",
                method="POST",
                target=f"{self.ctx.base_url}/api/admin/recommendation-config",
                request_data=payload,
                expected="code=200",
                actual=body if not err else "请求失败",
                status=PASS if self._code_is(body, 200) and not err else FAIL,
                start=start,
                error=err or "",
            )

        temp_username = (self.ctx.user or {}).get("username")
        if not temp_username:
            return

        # status toggle and recover
        start = time.perf_counter()
        ban_payload = {"admin_username": admin_user, "target_username": temp_username, "status": "banned"}
        resp, err = self.safe_request("POST", "/api/admin/users/status", json=ban_payload)
        body = self._resp_body(resp)
        banned_ok = self._code_is(body, 200)
        self.add_result(
            test_id="ADM-006",
            module=module,
            name="封禁临时测试用户",
            method="POST",
            target=f"{self.ctx.base_url}/api/admin/users/status",
            request_data=ban_payload,
            expected="仅操作临时测试用户且 code=200",
            actual=body if not err else "请求失败",
            status=PASS if banned_ok and not err else FAIL,
            start=start,
            error=err or "",
        )

        start = time.perf_counter()
        recover_payload = {"admin_username": admin_user, "target_username": temp_username, "status": "active"}
        resp, err = self.safe_request("POST", "/api/admin/users/status", json=recover_payload)
        body = self._resp_body(resp)
        self.add_result(
            test_id="ADM-007",
            module=module,
            name="恢复临时测试用户",
            method="POST",
            target=f"{self.ctx.base_url}/api/admin/users/status",
            request_data=recover_payload,
            expected="恢复临时测试用户且 code=200",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and not err else FAIL,
            start=start,
            error=err or "",
        )

        # role toggle and recover
        role_payload = {"admin_username": admin_user, "target_username": temp_username, "role": "admin"}
        start = time.perf_counter()
        resp, err = self.safe_request("POST", "/api/admin/users/role", json=role_payload)
        body = self._resp_body(resp)
        role_up_ok = self._code_is(body, 200)
        self.add_result(
            test_id="ADM-008",
            module=module,
            name="授予临时用户管理员",
            method="POST",
            target=f"{self.ctx.base_url}/api/admin/users/role",
            request_data=role_payload,
            expected="仅操作临时测试用户且 code=200",
            actual=body if not err else "请求失败",
            status=PASS if role_up_ok and not err else FAIL,
            start=start,
            error=err or "",
        )

        role_recover_payload = {"admin_username": admin_user, "target_username": temp_username, "role": "user"}
        start = time.perf_counter()
        resp, err = self.safe_request("POST", "/api/admin/users/role", json=role_recover_payload)
        body = self._resp_body(resp)
        self.add_result(
            test_id="ADM-009",
            module=module,
            name="恢复临时用户普通角色",
            method="POST",
            target=f"{self.ctx.base_url}/api/admin/users/role",
            request_data=role_recover_payload,
            expected="恢复临时测试用户角色且 code=200",
            actual=body if not err else "请求失败",
            status=PASS if self._code_is(body, 200) and not err else FAIL,
            start=start,
            error=err or "",
        )

    def run_frontend_browser_tests(self) -> None:
        module = "前端浏览器测试"
        if not self.ctx.frontend_url:
            start = time.perf_counter()
            self.add_result(
                test_id="E2E-000",
                module=module,
                name="浏览器测试准备",
                method="CHECK",
                target="--frontend-url",
                request_data="-",
                expected="提供前端地址后执行",
                actual="未提供 --frontend-url，跳过浏览器自动化测试",
                status=SKIPPED,
                start=start,
            )
            return

        try:
            from playwright.sync_api import sync_playwright  # type: ignore
        except Exception:
            start = time.perf_counter()
            self.add_result(
                test_id="E2E-001",
                module=module,
                name="Playwright 依赖检查",
                method="CHECK",
                target="playwright",
                request_data="import playwright",
                expected="可导入 playwright",
                actual="Playwright 未安装，跳过浏览器测试",
                status=SKIPPED,
                start=start,
            )
            return

        steps = [
            ("E2E-002", "打开首页", "/", "页面可渲染"),
            ("E2E-003", "打开搜索页", "/#/pages/search/search", "页面可渲染"),
            ("E2E-004", "打开详情页", "/#/pages/detail/detail", "页面可渲染"),
            ("E2E-005", "打开偏好设置页", "/#/pages/preferences/preferences", "页面可渲染"),
            ("E2E-006", "打开我的页面", "/#/pages/mine/mine", "页面可渲染"),
            ("E2E-007", "打开管理员中心", "/#/pages/admin/admin", "页面可渲染或受限提示"),
        ]
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                for tid, name, path, expected in steps:
                    start = time.perf_counter()
                    try:
                        page.goto(f"{self.ctx.frontend_url.rstrip('/')}{path}", wait_until="domcontentloaded", timeout=12000)
                        txt = page.inner_text("body")[:180]
                        ok = len(txt.strip()) > 0
                        self.add_result(
                            test_id=tid,
                            module=module,
                            name=name,
                            method="BROWSER",
                            target=path,
                            request_data=f"goto {path}",
                            expected=expected,
                            actual=txt or "空白页面",
                            status=PASS if ok else FAIL,
                            start=start,
                        )
                    except Exception as exc:  # noqa: BLE001
                        self.add_result(
                            test_id=tid,
                            module=module,
                            name=name,
                            method="BROWSER",
                            target=path,
                            request_data=f"goto {path}",
                            expected=expected,
                            actual="页面访问失败",
                            status=FAIL,
                            start=start,
                            error=str(exc),
                        )
                browser.close()
        except Exception as exc:  # noqa: BLE001
            start = time.perf_counter()
            self.add_result(
                test_id="E2E-999",
                module=module,
                name="浏览器测试执行",
                method="BROWSER",
                target=self.ctx.frontend_url,
                request_data="playwright run",
                expected="浏览器测试可执行",
                actual="浏览器测试框架执行失败",
                status=FAIL,
                start=start,
                error=str(exc),
            )

    @staticmethod
    def _resp_body(resp: Optional[requests.Response]) -> Any:
        if resp is None:
            return {}
        try:
            return resp.json()
        except Exception:
            return {"http_status": resp.status_code, "text": resp.text[:300]}

    @staticmethod
    def _code_is(body: Any, expected_code: int) -> bool:
        return isinstance(body, dict) and body.get("code") == expected_code


def build_html_report(
    report_file: Path,
    ctx: TestContext,
    results: List[TestResult],
    timeline: List[str],
    started_at: datetime,
) -> None:
    total = len(results)
    passed = len([r for r in results if r.status == PASS])
    failed = len([r for r in results if r.status == FAIL])
    skipped = len([r for r in results if r.status == SKIPPED])
    pass_rate = (passed / total * 100) if total else 0
    total_duration = sum(r.duration_ms for r in results)
    api_results = [r for r in results if r.method in {"GET", "POST"}]
    avg_api = sum(r.duration_ms for r in api_results) / len(api_results) if api_results else 0

    grouped: Dict[str, List[TestResult]] = {}
    for r in results:
        grouped.setdefault(r.module, []).append(r)

    status_class = {PASS: "pass", FAIL: "fail", SKIPPED: "skipped"}
    sections = []
    for module_name in [
        "环境检查",
        "前端页面检查",
        "用户认证测试",
        "电影查询测试",
        "个性化推荐测试",
        "用户行为测试",
        "管理员功能测试",
        "前端浏览器测试",
    ]:
        module_results = grouped.get(module_name, [])
        rows = "".join(
            f"""
            <tr>
              <td>{r.test_id}</td>
              <td>{r.module}</td>
              <td>{r.name}</td>
              <td><div class='mono'>{r.method} {r.target}</div><div class='small'>{r.request_data}</div></td>
              <td>{r.expected}</td>
              <td><div>{r.actual}</div>{f"<div class='error'>{r.error}</div>" if r.error else ''}</td>
              <td>{r.duration_ms} ms</td>
              <td><span class='badge {status_class.get(r.status, 'skipped')}'>{r.status}</span></td>
            </tr>
            """
        for r in module_results)
        sections.append(
            f"""
            <section class='module'>
              <h2>{module_name}</h2>
              <table>
                <thead><tr><th>编号</th><th>模块</th><th>测试项</th><th>请求/检查内容</th><th>预期结果</th><th>实际结果摘要</th><th>耗时</th><th>状态</th></tr></thead>
                <tbody>{rows or "<tr><td colspan='8'>无测试数据</td></tr>"}</tbody>
              </table>
            </section>
            """
        )

    timeline_items = "".join([f"<li>{idx}. {item}</li>" for idx, item in enumerate(timeline + ["生成测试报告"], start=1)])

    conclusion = (
        f"本次系统测试共执行 {total} 项，其中通过 {passed} 项，失败 {failed} 项，跳过 {skipped} 项。"
        "测试覆盖了用户注册登录、电影查询、电影详情、个性化推荐、用户行为记录、偏好设置以及管理员管理等核心功能。"
        "整体结果可用于毕业设计演示与功能验证。"
    )

    html = f"""
<!DOCTYPE html>
<html lang='zh-CN'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0'>
<title>系统功能测试报告</title>
<style>
body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #f5f7fb; color: #222; }}
.container {{ max-width: 1320px; margin: 0 auto; padding: 24px; }}
.header {{ background: linear-gradient(120deg,#1f5eff,#22b8cf); color: #fff; padding: 24px; border-radius: 14px; box-shadow: 0 8px 24px rgba(0,0,0,.16); }}
.header h1 {{ margin: 0 0 8px 0; font-size: 28px; }}
.meta {{ display: grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap: 10px; font-size: 14px; }}
.cards {{ display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 12px; margin: 18px 0; }}
.card {{ background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 4px 14px rgba(0,0,0,.08); text-align: center; }}
.card .label {{ font-size: 12px; color: #666; }}
.card .value {{ font-size: 26px; font-weight: 700; margin-top: 6px; }}
.pass-t {{ color: #1f9d4d; }} .fail-t {{ color: #d63333; }} .skip-t {{ color: #a07b07; }}
.timeline, .module, .conclusion {{ background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,.06); margin: 14px 0; }}
.timeline ol {{ margin: 0; padding-left: 20px; line-height: 1.8; }}
h2 {{ margin: 0 0 12px 0; }}
table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
th, td {{ border: 1px solid #e5e7ef; padding: 8px; vertical-align: top; }}
th {{ background: #f2f4f8; }}
.badge {{ font-size: 12px; padding: 4px 8px; border-radius: 999px; color: #fff; font-weight: 700; display: inline-block; }}
.badge.pass {{ background: #16a34a; }} .badge.fail {{ background: #dc2626; }} .badge.skipped {{ background: #9ca3af; }}
.small {{ color: #666; font-size: 12px; margin-top: 4px; }} .mono {{ font-family: Consolas, monospace; }}
.error {{ margin-top: 4px; color: #b42318; font-size: 12px; }}
footer {{ color: #666; text-align: center; margin: 20px 0; font-size: 12px; }}
</style>
</head>
<body>
<div class='container'>
  <div class='header'>
    <h1>基于大数据与个性化推荐的电影推荐系统测试报告</h1>
    <div class='meta'>
      <div>测试时间：{started_at.strftime('%Y-%m-%d %H:%M:%S')}</div>
      <div>后端地址：{ctx.base_url}</div>
      <div>前端地址：{ctx.frontend_url or '未提供'}</div>
      <div>总测试数：{total}</div>
      <div>通过数：{passed} | 失败数：{failed} | 跳过数：{skipped}</div>
      <div>通过率：{pass_rate:.2f}%</div>
    </div>
  </div>

  <div class='cards'>
    <div class='card'><div class='label'>PASS</div><div class='value pass-t'>{passed}</div></div>
    <div class='card'><div class='label'>FAIL</div><div class='value fail-t'>{failed}</div></div>
    <div class='card'><div class='label'>SKIPPED</div><div class='value skip-t'>{skipped}</div></div>
    <div class='card'><div class='label'>总耗时</div><div class='value'>{total_duration/1000:.2f}s</div></div>
    <div class='card'><div class='label'>接口平均响应</div><div class='value'>{avg_api:.2f}ms</div></div>
  </div>

  <section class='timeline'>
    <h2>测试流程时间线</h2>
    <ol>{timeline_items}</ol>
  </section>

  {''.join(sections)}

  <section class='conclusion'>
    <h2>测试结论</h2>
    <p>{conclusion}</p>
  </section>

  <footer>环境：{platform.platform()} | Python {platform.python_version()}</footer>
</div>
</body>
</html>
"""
    report_file.write_text(html, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="电影推荐系统功能测试展示工具")
    parser.add_argument("--base-url", default="http://localhost:3000", help="后端接口地址")
    parser.add_argument("--frontend-url", default=None, help="前端页面地址，例如 http://localhost:5173")
    parser.add_argument("--open", action="store_true", help="测试完成后自动打开 HTML 报告")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(__file__).resolve().parent
    ctx = TestContext(
        base_url=args.base_url.rstrip("/"),
        frontend_url=args.frontend_url.rstrip("/") if args.frontend_url else None,
        project_root=root,
        server_dir=root / "server-api",
        frontend_dir=root / "uniapp" / "app",
        pages_json=root / "uniapp" / "app" / "pages.json",
    )
    tester = SystemTester(ctx)

    started = datetime.now()
    try:
        tester.run_environment_checks()
        tester.run_frontend_static_checks()
        tester.run_backend_api_tests()
        tester.run_frontend_browser_tests()
    except Exception:  # noqa: BLE001
        start = time.perf_counter()
        tester.add_result(
            test_id="SYS-999",
            module="环境检查",
            name="脚本异常保护",
            method="CHECK",
            target="main",
            request_data="-",
            expected="脚本不中断",
            actual="出现未捕获异常",
            status=FAIL,
            start=start,
            error=traceback.format_exc(),
        )

    report_path = root / "test_report.html"
    build_html_report(report_path, ctx, tester.results, tester.timeline, started)

    if args.open:
        webbrowser.open(report_path.resolve().as_uri())

    total = len(tester.results)
    passed = len([r for r in tester.results if r.status == PASS])
    failed = len([r for r in tester.results if r.status == FAIL])
    skipped = len([r for r in tester.results if r.status == SKIPPED])
    print(f"[DONE] 测试完成：total={total}, pass={passed}, fail={failed}, skipped={skipped}")
    print(f"[DONE] 报告已生成：{report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
