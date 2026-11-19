# Universal AI Development Starter

프레임워크 중립 프로젝트 운영 템플릿, 버전 0.3.2. 앱·기술 스택·검증 명령은 아직 초기화되지 않았습니다. 실제 프로젝트 파일과 사용자 요구를 확인한 뒤 설정하세요.

## 핵심 파일

| 파일 | 용도 |
| --- | --- |
| AGENTS.md | 작업·보존·검증 기준과 실제 subsystem map |
| PROJECT.md | 확인한 프로젝트 목표·스택·실행 환경·제약 |
| .ai/models.yaml | 사용자가 선택한 역할별 모델 ID |
| .ai/routing.yaml | 단일 모델 선택·reasoning·순차 승격 지침 |
| .ai/verification.yaml | 실제 존재하는 명령만 설정; 초기값은 null |
| .ai/config.yaml | 선택 기능 상태; true만으로 기능이 구현되지는 않음 |
| .gitignore | 로컬 workflow·설치 경로·보고서·비밀 파일 제외 |

새 프로젝트에는 다른 앱의 사실이나 테스트 명령을 넣지 않습니다. 기존 프로젝트의 사실·모델·명령·문서는 보존합니다. 초기화와 실제 검증 실행·통과는 별개입니다.

## 모델과 검증

프로젝트 기본 모델은 GPT-6.2 Sol입니다. 모델 ID는 `.ai/models.yaml`에, 기본 역할은 `.ai/routing.yaml`에 있습니다. 대화 모델은 앱에서 선택합니다.

검증 명령은 프로젝트에 실제로 정의된 뒤 `.ai/verification.yaml`에 등록합니다.

## SOLID Engineering

정적 사이트의 진입점은 `docs/index.html`이고 공개 글은 `docs/posts.json`에 저장됩니다.

### 로컬 확인

프로젝트 루트에서 `python -m http.server 8000 --directory docs`를 실행하고 [로컬 블로그](http://localhost:8000)를 엽니다.

### GitHub Pages 배포

1. 이 프로젝트를 GitHub 저장소에 올립니다.
2. 저장소의 **Settings → Pages**에서 **Deploy from a branch**를 고르고 `main` 브랜치의 `/docs` 폴더를 선택합니다.
3. 배포된 사이트에서 **블로그 관리**를 열고 저장소와 게시 브랜치를 확인합니다. 해당 저장소로 범위를 제한한 fine-grained PAT에 **Contents: Read and write** 권한을 부여해 연결합니다.
4. **글쓰기**에서 Markdown 본문을 작성해 발행합니다. 상세 페이지에서 수정과 삭제가 가능합니다. 변경 사항은 저장소에 커밋되고 다음 Pages 배포 후 방문자에게 표시됩니다.

관리자 토큰은 연결 중인 탭의 메모리에만 유지됩니다. 새로고침하거나 **연결 해제**를 누르면 다시 연결해야 합니다. 글 삭제는 현재 게시 목록에서 제거하는 작업이며 이전 커밋에는 본문이 남습니다.

[GitHub Pages 배포 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [GitHub Contents API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents)
