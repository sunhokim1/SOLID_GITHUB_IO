# Project

## 유형

SOLID Engineering 기술 블로그. GitHub Pages 배포를 대상으로 한다.

## 목표와 사용자

독자는 개발 글을 검색하고 읽는다. 저장소에 쓰기 권한이 있는 팀원은 브라우저에서 글을 작성·수정·삭제한다.

## 기술 스택·실행 환경

정적 HTML, CSS, 브라우저 JavaScript. 진입점은 `docs/index.html`이다.

## 아키텍처

`docs/app.js`는 글 목록, 상세 화면과 관리자 편집기를 제어한다. 공개 글은 `docs/posts.json`에서 읽고 관리자 변경은 GitHub Contents API를 통해 같은 파일에 저장한다.

## 실행·검증

로컬 실행과 배포 설정은 `README.md`를 따른다.

## 제약

프로젝트 기본 모델은 GPT-6.2 Sol이다. 스타터는 프로젝트 파일로 적용하며, 대화에서 단일 모델로 작업한다. 토큰은 파일과 브라우저 영구 저장소에 저장하지 않는다.
