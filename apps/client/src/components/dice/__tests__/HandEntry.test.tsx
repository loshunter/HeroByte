/**
 * HandEntry — the control that records what the table actually threw.
 *
 * One control, three mount points (both rollers and the result panel), so the
 * rules it enforces are enforced once. The ones worth pinning are the ones that
 * would silently write a wrong number into shared history: an empty box must
 * not record a zero, and a fraction must not reach a log that only ever shows
 * whole numbers.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { HandEntry } from "../HandEntry";

afterEach(() => cleanup());

const setup = (onSubmit = vi.fn()) => {
  render(
    <HandEntry
      testId="entry"
      label="I ROLLED IT"
      prompt="What did 2d6 + 3 come to?"
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
};

const open = () => fireEvent.click(screen.getByTestId("entry-open"));
const type = (value: string) =>
  fireEvent.change(screen.getByTestId("entry-input"), { target: { value } });

describe("HandEntry", () => {
  it("stays out of the way until asked for", () => {
    setup();

    expect(screen.getByTestId("entry-open")).toHaveTextContent("I ROLLED IT");
    expect(screen.queryByTestId("entry-input")).toBeNull();
  });

  it("asks what was rolled, naming the formula so the number means something", () => {
    setup();
    open();

    expect(screen.getByText("What did 2d6 + 3 come to?")).toBeInTheDocument();
  });

  it("records the number and closes", () => {
    const onSubmit = setup();
    open();
    type("11");
    fireEvent.click(screen.getByTestId("entry-submit"));

    expect(onSubmit).toHaveBeenCalledWith(11);
    expect(screen.queryByTestId("entry-input")).toBeNull();
  });

  it("records a NEGATIVE total, which a bad modifier really can produce", () => {
    const onSubmit = setup();
    open();
    type("-2");
    fireEvent.click(screen.getByTestId("entry-submit"));

    expect(onSubmit).toHaveBeenCalledWith(-2);
  });

  it("refuses an EMPTY box rather than recording a zero", () => {
    // Number("") is 0. Submitted blind this writes a real, wrong result into
    // shared history — and zero is a legitimate total at some tables, so
    // nothing downstream could ever tell it was a mistake.
    const onSubmit = setup();
    open();
    fireEvent.click(screen.getByTestId("entry-submit"));

    expect(onSubmit).not.toHaveBeenCalled();
    // Still open: silently closing would read as "recorded".
    expect(screen.getByTestId("entry-input")).toBeInTheDocument();
  });

  it("refuses whitespace for the same reason", () => {
    const onSubmit = setup();
    open();
    type("   ");
    fireEvent.click(screen.getByTestId("entry-submit"));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses a fraction — no physical die lands on 7.5", () => {
    const onSubmit = setup();
    open();
    type("7.5");
    fireEvent.click(screen.getByTestId("entry-submit"));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("commits on Enter, because the keyboard is already open", () => {
    const onSubmit = setup();
    open();
    type("14");
    fireEvent.keyDown(screen.getByTestId("entry-input"), { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledWith(14);
  });

  it("abandons on Escape without recording", () => {
    const onSubmit = setup();
    open();
    type("14");
    fireEvent.keyDown(screen.getByTestId("entry-input"), { key: "Escape" });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByTestId("entry-input")).toBeNull();
  });

  it("forgets a cancelled number rather than pre-filling it next time", () => {
    const onSubmit = setup();
    open();
    type("99");
    fireEvent.click(screen.getByTestId("entry-cancel"));
    open();

    expect(screen.getByTestId("entry-input")).toHaveValue(null);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
