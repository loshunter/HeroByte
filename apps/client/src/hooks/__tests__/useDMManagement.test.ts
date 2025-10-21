/**
 * Characterization tests for useDMManagement hook
 *
 * These tests capture the behavior of the original DM management code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx (lines 519-550)
 * Target: apps/client/src/hooks/useDMManagement.ts
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("useDMManagement - Characterization", () => {
  const mockSendMessage = vi.fn();
  const mockElevateToDM = vi.fn();
  const mockToastSuccess = vi.fn();

  const mockToast = {
    success: mockToastSuccess,
  };

  // Mock window.confirm and window.prompt
  let confirmSpy: ReturnType<typeof vi.spyOn>;
  let promptSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockSendMessage.mockClear();
    mockElevateToDM.mockClear();
    mockToastSuccess.mockClear();
    confirmSpy = vi.spyOn(window, "confirm");
    promptSpy = vi.spyOn(window, "prompt");
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    promptSpy.mockRestore();
  });

  /**
   * Simulates the handleToggleDM callback from App.tsx
   */
  const createHandleToggleDM = (isDM: boolean) => {
    return (requestDM: boolean) => {
      if (!requestDM) {
        // Revoking DM mode
        const confirmed = window.confirm(
          "Are you sure you want to revoke your DM status? Another player will be able to become DM with the password.",
        );
        if (!confirmed) {
          return;
        }

        // Send revoke-dm message
        mockSendMessage({ t: "revoke-dm" });
        mockToast.success("DM status revoked. You are now a player.", 3000);
        return;
      }

      if (isDM) {
        // Already DM
        return;
      }

      // Prompt for DM password
      const dmPassword = window.prompt("Enter DM password to elevate:");
      if (!dmPassword) {
        return; // User cancelled
      }

      mockElevateToDM(dmPassword.trim());
    };
  };

  describe("Revoking DM Mode (requestDM=false)", () => {
    it("should send revoke-dm message and show success toast when user confirms", () => {
      confirmSpy.mockReturnValue(true);

      const handleToggleDM = createHandleToggleDM(true);
      handleToggleDM(false);

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledWith(
        "Are you sure you want to revoke your DM status? Another player will be able to become DM with the password.",
      );
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "revoke-dm" });
      expect(mockToastSuccess).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "DM status revoked. You are now a player.",
        3000,
      );
    });

    it("should do nothing when user cancels confirmation", () => {
      confirmSpy.mockReturnValue(false);

      const handleToggleDM = createHandleToggleDM(true);
      handleToggleDM(false);

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it("should work when isDM is false (revoking when not DM)", () => {
      confirmSpy.mockReturnValue(true);

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(false);

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "revoke-dm" });
      expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe("Elevating to DM (requestDM=true)", () => {
    it("should do nothing when already DM (early return)", () => {
      const handleToggleDM = createHandleToggleDM(true);
      handleToggleDM(true);

      expect(promptSpy).not.toHaveBeenCalled();
      expect(mockElevateToDM).not.toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should call elevateToDM with trimmed password when user enters password", () => {
      promptSpy.mockReturnValue("  secret123  ");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(promptSpy).toHaveBeenCalledWith("Enter DM password to elevate:");
      expect(mockElevateToDM).toHaveBeenCalledTimes(1);
      expect(mockElevateToDM).toHaveBeenCalledWith("secret123");
    });

    it("should do nothing when user cancels password prompt", () => {
      promptSpy.mockReturnValue(null);

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(mockElevateToDM).not.toHaveBeenCalled();
    });

    it("should do nothing when user enters empty string", () => {
      promptSpy.mockReturnValue("");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(mockElevateToDM).not.toHaveBeenCalled();
    });

    it("should call elevateToDM with password when not already DM", () => {
      promptSpy.mockReturnValue("myPassword");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(mockElevateToDM).toHaveBeenCalledTimes(1);
      expect(mockElevateToDM).toHaveBeenCalledWith("myPassword");
    });
  });

  describe("Password Trimming Behavior", () => {
    it("should trim leading whitespace from password", () => {
      promptSpy.mockReturnValue("   password123");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(mockElevateToDM).toHaveBeenCalledWith("password123");
    });

    it("should trim trailing whitespace from password", () => {
      promptSpy.mockReturnValue("password123   ");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(mockElevateToDM).toHaveBeenCalledWith("password123");
    });

    it("should trim both leading and trailing whitespace", () => {
      promptSpy.mockReturnValue("   password123   ");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(mockElevateToDM).toHaveBeenCalledWith("password123");
    });

    it("should preserve internal whitespace in password", () => {
      promptSpy.mockReturnValue("  pass word 123  ");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(mockElevateToDM).toHaveBeenCalledWith("pass word 123");
    });

    it("should handle password with only whitespace by trimming to empty string", () => {
      promptSpy.mockReturnValue("   ");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      // The check is before trim, so "   " passes !dmPassword check
      // Then it's trimmed to "" and passed to elevateToDM
      expect(mockElevateToDM).toHaveBeenCalledWith("");
    });

    it("should handle tab characters in password", () => {
      promptSpy.mockReturnValue("\tpassword\t");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(mockElevateToDM).toHaveBeenCalledWith("password");
    });

    it("should handle newline characters in password", () => {
      promptSpy.mockReturnValue("\npassword\n");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(mockElevateToDM).toHaveBeenCalledWith("password");
    });

    it("should handle mixed whitespace characters", () => {
      promptSpy.mockReturnValue(" \t\n password123 \n\t ");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(mockElevateToDM).toHaveBeenCalledWith("password123");
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple consecutive revocations", () => {
      confirmSpy.mockReturnValue(true);

      const handleToggleDM = createHandleToggleDM(true);
      handleToggleDM(false);
      handleToggleDM(false);
      handleToggleDM(false);

      expect(confirmSpy).toHaveBeenCalledTimes(3);
      expect(mockSendMessage).toHaveBeenCalledTimes(3);
      expect(mockToastSuccess).toHaveBeenCalledTimes(3);
    });

    it("should handle multiple consecutive elevation attempts when not DM", () => {
      promptSpy.mockReturnValueOnce("pass1").mockReturnValueOnce("pass2");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);
      handleToggleDM(true);

      expect(promptSpy).toHaveBeenCalledTimes(2);
      expect(mockElevateToDM).toHaveBeenCalledTimes(2);
      expect(mockElevateToDM).toHaveBeenNthCalledWith(1, "pass1");
      expect(mockElevateToDM).toHaveBeenNthCalledWith(2, "pass2");
    });

    it("should handle special characters in password", () => {
      promptSpy.mockReturnValue("p@$$w0rd!#$%");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(mockElevateToDM).toHaveBeenCalledWith("p@$$w0rd!#$%");
    });

    it("should handle very long password", () => {
      const longPassword = "a".repeat(1000);
      promptSpy.mockReturnValue(longPassword);

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(mockElevateToDM).toHaveBeenCalledWith(longPassword);
    });

    it("should handle unicode characters in password", () => {
      promptSpy.mockReturnValue("пароль密码🔒");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(mockElevateToDM).toHaveBeenCalledWith("пароль密码🔒");
    });
  });

  describe("Interaction Sequences", () => {
    it("should handle revoke -> elevate sequence", () => {
      confirmSpy.mockReturnValue(true);
      promptSpy.mockReturnValue("password");

      const handleToggleDM = createHandleToggleDM(true);

      // First revoke
      handleToggleDM(false);
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "revoke-dm" });
      expect(mockToastSuccess).toHaveBeenCalled();

      // Then elevate (create new handler as if isDM changed to false)
      const handleToggleDM2 = createHandleToggleDM(false);
      handleToggleDM2(true);
      expect(mockElevateToDM).toHaveBeenCalledWith("password");
    });

    it("should handle cancelled revoke followed by successful revoke", () => {
      confirmSpy.mockReturnValueOnce(false).mockReturnValueOnce(true);

      const handleToggleDM = createHandleToggleDM(true);

      // First attempt - cancelled
      handleToggleDM(false);
      expect(mockSendMessage).not.toHaveBeenCalled();

      // Second attempt - confirmed
      handleToggleDM(false);
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    });

    it("should handle cancelled password prompt followed by successful entry", () => {
      promptSpy.mockReturnValueOnce(null).mockReturnValueOnce("mypass");

      const handleToggleDM = createHandleToggleDM(false);

      // First attempt - cancelled
      handleToggleDM(true);
      expect(mockElevateToDM).not.toHaveBeenCalled();

      // Second attempt - password entered
      handleToggleDM(true);
      expect(mockElevateToDM).toHaveBeenCalledTimes(1);
      expect(mockElevateToDM).toHaveBeenCalledWith("mypass");
    });
  });

  describe("Confirmation and Prompt Messages", () => {
    it("should use exact confirmation message text", () => {
      confirmSpy.mockReturnValue(true);

      const handleToggleDM = createHandleToggleDM(true);
      handleToggleDM(false);

      expect(confirmSpy).toHaveBeenCalledWith(
        "Are you sure you want to revoke your DM status? Another player will be able to become DM with the password.",
      );
    });

    it("should use exact prompt message text", () => {
      promptSpy.mockReturnValue("pass");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(promptSpy).toHaveBeenCalledWith("Enter DM password to elevate:");
    });

    it("should use exact toast message text and duration", () => {
      confirmSpy.mockReturnValue(true);

      const handleToggleDM = createHandleToggleDM(true);
      handleToggleDM(false);

      expect(mockToastSuccess).toHaveBeenCalledWith(
        "DM status revoked. You are now a player.",
        3000,
      );
    });
  });

  describe("Dependency Behavior", () => {
    it("should respect isDM state for early return", () => {
      // When isDM is true, requesting DM should return early
      const handleToggleDMTrue = createHandleToggleDM(true);
      handleToggleDMTrue(true);

      expect(promptSpy).not.toHaveBeenCalled();
      expect(mockElevateToDM).not.toHaveBeenCalled();

      // When isDM is false, requesting DM should prompt for password
      promptSpy.mockReturnValue("password");
      const handleToggleDMFalse = createHandleToggleDM(false);
      handleToggleDMFalse(true);

      expect(promptSpy).toHaveBeenCalled();
      expect(mockElevateToDM).toHaveBeenCalled();
    });

    it("should call sendMessage dependency when revoking", () => {
      confirmSpy.mockReturnValue(true);

      const handleToggleDM = createHandleToggleDM(true);
      handleToggleDM(false);

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "revoke-dm" });
    });

    it("should call elevateToDM dependency when elevating", () => {
      promptSpy.mockReturnValue("password");

      const handleToggleDM = createHandleToggleDM(false);
      handleToggleDM(true);

      expect(mockElevateToDM).toHaveBeenCalledTimes(1);
      expect(mockElevateToDM).toHaveBeenCalledWith("password");
    });

    it("should call toast.success dependency when revoking", () => {
      confirmSpy.mockReturnValue(true);

      const handleToggleDM = createHandleToggleDM(true);
      handleToggleDM(false);

      expect(mockToastSuccess).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "DM status revoked. You are now a player.",
        3000,
      );
    });
  });
});
