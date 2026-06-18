import React from "react";
import TodoItem from "./TodoItem.jsx";

// TodoList는 todos 배열을 받아 화면의 목록으로 바꾸는 컴포넌트입니다.
function TodoList({ todos, onToggle, onDelete }) {
  // 빈 배열일 때도 사용자가 볼 화면을 준비해둡니다.
  if (todos.length === 0) {
    return <p className="empty-message">등록된 할 일이 없습니다.</p>;
  }

  return (
    <ul className="todo-list">
      {/* 배열 데이터를 화면에 반복해서 보여줄 때 map을 사용합니다. */}
      {todos.map((todo) => {
        // TODO 1:
        // todo 하나를 TodoItem 컴포넌트 하나로 바꿔보세요.
        // 힌트:
        // return (
        //   <TodoItem
        //     key={todo.id}
        //     todo={todo}
        //     onToggle={onToggle}
        //     onDelete={onDelete}
        //   />
        // );
        return <li key={todo.id}>{todo.content}</li>;
      })}
    </ul>
  );
}

export default TodoList;
