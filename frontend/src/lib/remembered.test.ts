import { describe, expect, it } from "vitest";

import { forgetRemembered, readRemembered, saveRemembered } from "./remembered";

describe("remembered data", () => {
  it("is nothing until it is saved", () => {
    expect(readRemembered()).toBeNull();
  });

  it("keeps the name, phone and email trimmed", () => {
    saveRemembered({ name: " Rosa Quispe ", phone: " 987 111 222 ", email: " rosa@example.com " });

    expect(readRemembered()).toEqual({ name: "Rosa Quispe", phone: "987 111 222", email: "rosa@example.com" });
  });

  it("does not keep that the terms were accepted", () => {
    saveRemembered({ name: "Rosa", phone: "987 111 222", email: "" });

    expect(localStorage.getItem("separa.me.v1")).not.toMatch(/accept/i);
  });

  it("is forgotten on request", () => {
    saveRemembered({ name: "Rosa", phone: "987 111 222", email: "" });

    forgetRemembered();

    expect(readRemembered()).toBeNull();
  });

  it("treats damaged content as nothing", () => {
    localStorage.setItem("separa.me.v1", "{oops");
    expect(readRemembered()).toBeNull();

    localStorage.setItem("separa.me.v1", JSON.stringify({ name: 3 }));
    expect(readRemembered()).toBeNull();

    localStorage.setItem("separa.me.v1", JSON.stringify({ name: " ", phone: "" }));
    expect(readRemembered()).toBeNull();
  });
});
