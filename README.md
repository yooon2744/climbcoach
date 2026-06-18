# React TODO Student Live

10주차 React TODO 라이브코딩 학생 실습용 버전입니다.

## 실행

Node.js 18 이상을 사용합니다. `nvm`을 쓴다면 아래처럼 맞출 수 있습니다.

```bash
nvm use
```

```bash
npm install
npm run dev
```

## 수업 핵심

- `App`이 전체 TODO 목록 state를 관리합니다.
- `TodoForm`은 입력값 state를 관리하고 새 할 일을 부모에게 전달합니다.
- `TodoList`는 배열을 목록으로 렌더링합니다.
- `TodoItem`은 개별 할 일의 완료/삭제 이벤트를 부모 함수로 연결합니다.
- 추가, 완료 변경, 삭제는 모두 기존 배열을 직접 수정하지 않고 새 배열을 만들어 처리합니다.

## 실습 방법

코드 안의 `TODO` 주석을 따라 빈칸을 채워 완성합니다.

1. `TodoForm`에서 controlled input과 submit 처리를 완성합니다.
2. `App`에서 `addTodo`, `toggleTodo`, `deleteTodo`를 완성합니다.
3. `TodoList`에서 `map()`으로 목록 렌더링을 완성합니다.
4. `TodoItem`에서 체크박스와 삭제 버튼 이벤트를 연결합니다.
