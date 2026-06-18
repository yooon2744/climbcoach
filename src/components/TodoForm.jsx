import React, { useState } from "react";

// onAdd는 App에서 내려준 함수입니다.
// TodoForm은 새 할 일을 입력받고, 제출되면 onAdd를 호출합니다.
function TodoForm({ onAdd }) {
  // inputValue는 입력창 안에서만 필요한 값입니다.
  // 그래서 전체 App이 아니라 TodoForm 안에서 state로 관리합니다.
  // TODO 1:
  // useState를 사용해서 입력창 값을 관리해보세요.
  // 힌트: const [inputValue, setInputValue] = useState("");
  const [inputValue, setInputValue] = useState("");

  function handleSubmit(event) {
    // form은 기본적으로 제출 시 페이지를 새로고침합니다.
    // React 앱에서는 새로고침 없이 state만 바꾸기 위해 기본 동작을 막습니다.
    // TODO 2:
    // event.preventDefault()를 호출해보세요.
    event.preventDefault();

    // 앞뒤 공백만 입력한 경우를 막기 위해 trim으로 정리합니다.
    // TODO 3:
    // inputValue.trim()으로 정리한 값을 trimmedValue에 담아보세요.
    const trimmedValue = inputValue.trim();

    if (!trimmedValue) {
      return;
    }

    // 입력한 값을 부모 컴포넌트 App으로 올려보냅니다.
    // TODO 4:
    // onAdd를 호출해서 trimmedValue를 부모에게 전달해보세요.
    console.log("부모에게 전달할 값:", trimmedValue);

    // 추가가 끝나면 입력창을 비워 다음 입력을 받을 준비를 합니다.
    // TODO 5:
    // setInputValue("")로 입력창을 비워보세요.
  }

  return (
    <form className="todo-form" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="todo-input">
        새 할 일
      </label>
      <input
        id="todo-input"
        type="text"
        // value와 onChange를 함께 쓰면 React가 input 값을 관리합니다.
        // 이런 input을 controlled input이라고 부릅니다.
        // TODO 6:
        // value에는 inputValue를 연결합니다.
        value={inputValue}
        placeholder="할 일을 입력하세요"
        // TODO 7:
        // onChange에서 setInputValue(event.target.value)를 호출해보세요.
        onChange={(event) => console.log("입력값:", event.target.value)}
      />
      <button type="submit">추가</button>
    </form>
  );
}

export default TodoForm;
