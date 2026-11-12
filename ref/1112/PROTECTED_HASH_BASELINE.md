# COST-1112 보호 파일 해시 기준 (작업 전)

시각: 2026-11-12 11:32 KST
기준 커밋: a763f1d (origin/main)

| 파일 | sha256 |
|---|---|
| `config.json` | `9cab12fb5d22d4959ff1713e1f2c60afb511beda90bd520809fd52f6e6502ca9` |
| `shim.js` | `ef61bc30f49b944e0eed862257c5777a1fc5cea4e66f33195ad95737a9586851` |
| `auth/mode.js` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `index.html` | `d0a4a6438f15f982acce34347aee07df3f2570fef054d414d3190ed95712e032` |
| `bundle.js` | `f51c7fef0c155ed83fdd221099883f656eecb80c94e44e742b828522cc3def26` |

작업 후 같은 명령으로 다시 해시해 이 표와 한 글자도 달라지면 실패다.
로그는 `ref/1112/PROTECTED_HASH_LOG.md`에 작업 후 값을 남긴다.

참고 (11:43 KST): `r9_api.js`는 계획 저장 최소 수정이 허용되어 이 불변 목록에서 뺐다. 시트 ID·권한·공통비 탭·다른 API는 그대로여야 한다.
