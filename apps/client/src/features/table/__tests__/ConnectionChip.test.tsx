import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ConnectionChip } from "../ConnectionChip";

afterEach(cleanup);

describe("ConnectionChip — the link to the server, in the layout", () => {
  it("says ONLINE with a green dot while connected, as a status region", () => {
    render(<ConnectionChip isConnected />);
    const chip = screen.getByRole("status");
    expect(chip).toHaveTextContent("ONLINE");
    expect(chip).toHaveTextContent("🟢");
    expect(chip.className).toMatch(/connection-chip--online/);
  });

  it("says OFFLINE with a red dot when the server is lost", () => {
    render(<ConnectionChip isConnected={false} />);
    const chip = screen.getByRole("status");
    expect(chip).toHaveTextContent("OFFLINE");
    expect(chip).toHaveTextContent("🔴");
    expect(chip.className).toMatch(/connection-chip--offline/);
  });

  it("keeps the text the table has always read, dot then word, with nothing between", () => {
    // Specs and the mobile shell read the chip by this exact content.
    render(<ConnectionChip isConnected />);
    expect(screen.getByTestId("connection-chip").textContent).toBe("🟢ONLINE");
  });
});
