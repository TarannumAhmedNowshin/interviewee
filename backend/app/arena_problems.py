"""Curated coding-arena problems.

I/O contract: every problem reads from stdin and writes to stdout, so the same
hidden test cases grade any language. Starter code handles parsing; the candidate
fills in the function body.
"""

from typing import TypedDict


class TestCase(TypedDict):
    input: str
    output: str
    hidden: bool


class Problem(TypedDict):
    id: str
    title: str
    difficulty: str  # easy | medium | hard
    patterns: list[str]
    prompt: str
    io_note: str
    starter: dict[str, str]
    tests: list[TestCase]
    complexity: str


PROBLEMS: list[Problem] = [
    {
        "id": "two-sum",
        "title": "Two Sum",
        "difficulty": "easy",
        "patterns": ["Hashing", "Arrays"],
        "prompt": (
            "Given an array of integers `nums` and an integer `target`, return the "
            "indices (0-based) of the two numbers that add up to `target`. Exactly one "
            "solution exists; return the indices in increasing order."
        ),
        "io_note": "Line 1: space-separated integers. Line 2: the target integer.",
        "complexity": "Target: O(n) time, O(n) space.",
        "starter": {
            "python": (
                "import sys\n\n\n"
                "def two_sum(nums, target):\n"
                "    # TODO: return the two 0-based indices as a list [i, j]\n"
                "    pass\n\n\n"
                "def main():\n"
                "    data = sys.stdin.read().splitlines()\n"
                "    nums = list(map(int, data[0].split()))\n"
                "    target = int(data[1])\n"
                "    i, j = sorted(two_sum(nums, target))\n"
                "    print(i, j)\n\n\n"
                "main()\n"
            ),
            "javascript": (
                "function twoSum(nums, target) {\n"
                "  // TODO: return the two 0-based indices as [i, j]\n"
                "}\n\n"
                "const data = require('fs').readFileSync(0, 'utf8').split('\\n');\n"
                "const nums = data[0].trim().split(/\\s+/).map(Number);\n"
                "const target = Number(data[1]);\n"
                "const ans = twoSum(nums, target).sort((a, b) => a - b);\n"
                "console.log(ans[0], ans[1]);\n"
            ),
            "cpp": (
                "#include <bits/stdc++.h>\n"
                "using namespace std;\n\n"
                "vector<int> twoSum(vector<int>& nums, int target) {\n"
                "    // TODO: return the two 0-based indices\n"
                "    return {};\n"
                "}\n\n"
                "int main() {\n"
                "    string line;\n"
                "    getline(cin, line);\n"
                "    istringstream ss(line);\n"
                "    vector<int> nums; int x;\n"
                "    while (ss >> x) nums.push_back(x);\n"
                "    int target; cin >> target;\n"
                "    vector<int> a = twoSum(nums, target);\n"
                "    sort(a.begin(), a.end());\n"
                "    cout << a[0] << ' ' << a[1] << endl;\n"
                "}\n"
            ),
        },
        "tests": [
            {"input": "2 7 11 15\n9", "output": "0 1", "hidden": False},
            {"input": "3 2 4\n6", "output": "1 2", "hidden": False},
            {"input": "3 3\n6", "output": "0 1", "hidden": True},
            {"input": "2 5 8 3\n10", "output": "0 2", "hidden": True},
        ],
    },
    {
        "id": "valid-parentheses",
        "title": "Valid Parentheses",
        "difficulty": "easy",
        "patterns": ["Stack", "Strings"],
        "prompt": (
            "Given a string `s` containing just the characters `()[]{}`, determine if "
            "the input is valid: brackets must close in the correct order and each "
            "closing bracket matches the most recent unclosed opening bracket."
        ),
        "io_note": "A single line: the string s (may be empty).",
        "complexity": "Target: O(n) time, O(n) space.",
        "starter": {
            "python": (
                "import sys\n\n\n"
                "def is_valid(s):\n"
                "    # TODO: return True or False\n"
                "    pass\n\n\n"
                "def main():\n"
                "    s = sys.stdin.readline().rstrip('\\n')\n"
                "    print('true' if is_valid(s) else 'false')\n\n\n"
                "main()\n"
            ),
            "javascript": (
                "function isValid(s) {\n"
                "  // TODO: return true or false\n"
                "}\n\n"
                "const s = require('fs').readFileSync(0, 'utf8').split('\\n')[0];\n"
                "console.log(isValid(s) ? 'true' : 'false');\n"
            ),
            "cpp": (
                "#include <bits/stdc++.h>\n"
                "using namespace std;\n\n"
                "bool isValid(const string& s) {\n"
                "    // TODO: return true or false\n"
                "    return false;\n"
                "}\n\n"
                "int main() {\n"
                "    string s;\n"
                "    getline(cin, s);\n"
                "    cout << (isValid(s) ? \"true\" : \"false\") << endl;\n"
                "}\n"
            ),
        },
        "tests": [
            {"input": "()", "output": "true", "hidden": False},
            {"input": "()[]{}", "output": "true", "hidden": False},
            {"input": "(]", "output": "false", "hidden": False},
            {"input": "([)]", "output": "false", "hidden": True},
            {"input": "{[]}", "output": "true", "hidden": True},
        ],
    },
    {
        "id": "max-subarray",
        "title": "Maximum Subarray",
        "difficulty": "medium",
        "patterns": ["Dynamic Programming", "Greedy"],
        "prompt": (
            "Given an integer array `nums`, find the contiguous subarray (containing at "
            "least one number) with the largest sum and return that sum."
        ),
        "io_note": "A single line: space-separated integers (may be negative).",
        "complexity": "Target: O(n) time, O(1) space (Kadane's algorithm).",
        "starter": {
            "python": (
                "import sys\n\n\n"
                "def max_subarray(nums):\n"
                "    # TODO: return the maximum subarray sum\n"
                "    pass\n\n\n"
                "def main():\n"
                "    nums = list(map(int, sys.stdin.read().split()))\n"
                "    print(max_subarray(nums))\n\n\n"
                "main()\n"
            ),
            "javascript": (
                "function maxSubarray(nums) {\n"
                "  // TODO: return the maximum subarray sum\n"
                "}\n\n"
                "const nums = require('fs').readFileSync(0, 'utf8')"
                ".trim().split(/\\s+/).map(Number);\n"
                "console.log(maxSubarray(nums));\n"
            ),
            "cpp": (
                "#include <bits/stdc++.h>\n"
                "using namespace std;\n\n"
                "long long maxSubarray(vector<int>& nums) {\n"
                "    // TODO: return the maximum subarray sum\n"
                "    return 0;\n"
                "}\n\n"
                "int main() {\n"
                "    vector<int> nums; int x;\n"
                "    while (cin >> x) nums.push_back(x);\n"
                "    cout << maxSubarray(nums) << endl;\n"
                "}\n"
            ),
        },
        "tests": [
            {"input": "-2 1 -3 4 -1 2 1 -5 4", "output": "6", "hidden": False},
            {"input": "1", "output": "1", "hidden": False},
            {"input": "5 4 -1 7 8", "output": "23", "hidden": False},
            {"input": "-1 -2 -3", "output": "-1", "hidden": True},
            {"input": "-5", "output": "-5", "hidden": True},
        ],
    },
]

_BY_ID = {p["id"]: p for p in PROBLEMS}


def get(problem_id: str) -> Problem | None:
    return _BY_ID.get(problem_id)


def public_summary() -> list[dict]:
    """List view: no test cases or starter code."""
    return [
        {
            "id": p["id"],
            "title": p["title"],
            "difficulty": p["difficulty"],
            "patterns": p["patterns"],
        }
        for p in PROBLEMS
    ]
