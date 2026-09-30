import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ActualModal, actions } from "./modalOwners.fixtures";

afterEach(cleanup);

describe("foreground modal action preservation", () => {
  it("Initiative still saves a manual total through its existing Enter handler", () => {
    const calls = actions();
    render(<ActualModal kind="initiative" calls={calls} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter a roll by hand" }));
    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "14" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(calls.set).toHaveBeenCalledExactlyOnceWith(16, 2);
    expect(calls.roll).not.toHaveBeenCalled();
    expect(calls.close).not.toHaveBeenCalled();
  });

  it("Initiative still rolls the modifier and closes through the existing action", () => {
    const calls = actions();
    render(<ActualModal kind="initiative" calls={calls} />);
    fireEvent.click(screen.getByRole("button", { name: "Roll d20 now" }));
    // An untouched dial leaves the stored +2 to the server.
    expect(calls.roll).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(calls.set).not.toHaveBeenCalled();
    expect(calls.close).toHaveBeenCalledTimes(1);
  });

  it("Character Creation still trims and creates through its input Enter handler", () => {
    const calls = actions();
    render(<ActualModal kind="character" calls={calls} />);
    const input = screen.getByPlaceholderText("Enter character name...");
    fireEvent.change(input, { target: { value: "  Hero  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(calls.create).toHaveBeenCalledExactlyOnceWith("Hero");
    expect(calls.close).not.toHaveBeenCalled();
  });

  it("DM elevation still submits its unchanged password through the actual form", () => {
    const calls = actions();
    render(<ActualModal kind="dm" calls={calls} />);
    const input = screen.getByLabelText("Enter DM Password:");
    fireEvent.change(input, { target: { value: " keeper-password " } });
    const form = input.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(calls.elevate).toHaveBeenCalledExactlyOnceWith(" keeper-password ");
    expect(calls.bootstrap).not.toHaveBeenCalled();
    expect(calls.revoke).not.toHaveBeenCalled();
    expect(calls.close).not.toHaveBeenCalled();
  });
});
