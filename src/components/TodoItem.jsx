import React from "react";

// TodoItem은 할 일 하나를 화면에 보여주는 컴포넌트입니다.
// todo 데이터와 이벤트 함수는 부모 컴포넌트에서 props로 받습니다.
function TodoItem({ todo, onToggle, onDelete }) {
  return (
    <li className="todo-item">
      <label className="todo-label">
        <input
          type="checkbox"
          // checked는 todo의 완료 상태를 화면에 반영합니다.
          // state가 true면 체크되고, false면 체크되지 않습니다.
          // TODO 1:
          // checked에 todo.isDone을 연결해보세요.
          checked={todo.isDone}
          // 클릭된 todo의 id를 부모 함수로 전달합니다.
          // 이렇게 자식에서 일어난 이벤트가 부모 state 변경으로 이어집니다.
          // TODO 2:
          // onChange에서 onToggle(todo.id)를 호출해보세요.
          onChange={() => console.log("완료 클릭:", todo.id)}
        />
        {/* TODO 3: todo.isDone이 true일 때 done class가 붙도록 삼항 연산자를 완성해보세요. */}
        <span className="todo-text">
          {todo.content}
        </span>
      </label>

      <button
        className="todo-delete-button"
        type="button"
        // 삭제도 마찬가지로 id만 부모에게 알려줍니다.
        // 실제 todos 배열을 바꾸는 일은 App의 deleteTodo가 담당합니다.
        // TODO 4:
        // onClick에서 onDelete(todo.id)를 호출해보세요.
        onClick={() => console.log("삭제 클릭:", todo.id)}
      >
        삭제
      </button>
    </li>
  );
}

export default TodoItem;
