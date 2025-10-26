/**
 * Unit tests for CruxExtractor class
 *
 * Run with: runUnitTests()
 */

function runUnitTests() {
  TestFramework.reset();
  TestMocks.setupGlobalMocks();

  testConstructor();
  testIsValidUrl();
  testBuildRequestUrls();
  testFetchData();
  testNormalizeData();
  testAddToSpreadsheet();
  testGetExecutionHistorySheet();
  testLogExecutionHistory();
  testRun();

  TestMocks.cleanupGlobalMocks();
  return TestFramework.printResults();
}

/**
 * Test constructor validation
 */
function testConstructor() {
  TestFramework.describe("CruxExtractor Constructor", () => {
    TestFramework.it("should create instance with valid config", () => {
      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
      });

      TestFramework.expect(extractor.urls).toEqual(["https://example.com"]);
      TestFramework.expect(extractor.spreadsheetId).toBe("test-sheet-id");
      TestFramework.expect(extractor.apiKey).toBe("test-api-key");
    });

    TestFramework.it("should trim whitespace from inputs", () => {
      const extractor = new CruxExtractor({
        urls: ["  https://example.com  "],
        spreadsheetId: "  test-sheet-id  ",
        apiKey: "  test-api-key  ",
      });

      TestFramework.expect(extractor.urls).toEqual(["https://example.com"]);
      TestFramework.expect(extractor.spreadsheetId).toBe("test-sheet-id");
      TestFramework.expect(extractor.apiKey).toBe("test-api-key");
    });

    TestFramework.it("should throw error if urls is not an array", () => {
      TestFramework.expect(() => {
        new CruxExtractor({
          urls: "not-an-array",
          spreadsheetId: "test-sheet-id",
          apiKey: "test-api-key",
        });
      }).toThrow("'urls' must be a non-empty array");
    });

    TestFramework.it("should throw error if urls array is empty", () => {
      TestFramework.expect(() => {
        new CruxExtractor({
          urls: [],
          spreadsheetId: "test-sheet-id",
          apiKey: "test-api-key",
        });
      }).toThrow("'urls' must be a non-empty array");
    });

    TestFramework.it("should throw error if urls contain non-strings", () => {
      TestFramework.expect(() => {
        new CruxExtractor({
          urls: ["https://example.com", 123, null],
          spreadsheetId: "test-sheet-id",
          apiKey: "test-api-key",
        });
      }).toThrow("All URLs must be non-empty strings");
    });

    TestFramework.it("should throw error if urls contain empty strings", () => {
      TestFramework.expect(() => {
        new CruxExtractor({
          urls: ["https://example.com", "   "],
          spreadsheetId: "test-sheet-id",
          apiKey: "test-api-key",
        });
      }).toThrow("All URLs must be non-empty strings");
    });

    TestFramework.it("should throw error if spreadsheetId is empty", () => {
      TestFramework.expect(() => {
        new CruxExtractor({
          urls: ["https://example.com"],
          spreadsheetId: "",
          apiKey: "test-api-key",
        });
      }).toThrow("'spreadsheetId' must be a non-empty string");
    });

    TestFramework.it("should throw error if apiKey is empty", () => {
      TestFramework.expect(() => {
        new CruxExtractor({
          urls: ["https://example.com"],
          spreadsheetId: "test-sheet-id",
          apiKey: "",
        });
      }).toThrow("'apiKey' must be a non-empty string");
    });

    TestFramework.it("should throw error if formFactor is not array", () => {
      TestFramework.expect(() => {
        new CruxExtractor({
          urls: ["https://example.com"],
          spreadsheetId: "test-sheet-id",
          apiKey: "test-api-key",
          formFactor: "PHONE",
        });
      }).toThrow("'formFactor' must be a non-empty array");
    });

    TestFramework.it("should use default values for optional params", () => {
      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
      });

      TestFramework.expect(extractor.formFactor).toContain("PHONE");
      TestFramework.expect(extractor.formFactor).toContain("DESKTOP");
      TestFramework.expect(extractor.sheetTabName).toBe("cruxData");
    });
  });
}

/**
 * Test URL validation
 */
function testIsValidUrl() {
  TestFramework.describe("isValidUrl", () => {
    const extractor = new CruxExtractor({
      urls: ["https://example.com"],
      spreadsheetId: "test-sheet-id",
      apiKey: "test-api-key",
    });

    TestFramework.it("should return true for valid HTTP URL", () => {
      TestFramework.expect(
        extractor.isValidUrl("http://example.com")
      ).toBeTruthy();
    });

    TestFramework.it("should return true for valid HTTPS URL", () => {
      TestFramework.expect(
        extractor.isValidUrl("https://example.com")
      ).toBeTruthy();
    });

    TestFramework.it("should return false for non-HTTP(S) URLs", () => {
      TestFramework.expect(
        extractor.isValidUrl("ftp://example.com")
      ).toBeFalsy();
      TestFramework.expect(
        extractor.isValidUrl("javascript:alert(1)")
      ).toBeFalsy();
    });

    TestFramework.it("should return false for invalid URLs", () => {
      TestFramework.expect(extractor.isValidUrl("not-a-url")).toBeFalsy();
      TestFramework.expect(extractor.isValidUrl("")).toBeFalsy();
    });

    TestFramework.it("should return false for null or undefined", () => {
      TestFramework.expect(extractor.isValidUrl(null)).toBeFalsy();
      TestFramework.expect(extractor.isValidUrl(undefined)).toBeFalsy();
    });

    TestFramework.it("should return false for non-string types", () => {
      TestFramework.expect(extractor.isValidUrl(123)).toBeFalsy();
      TestFramework.expect(extractor.isValidUrl({})).toBeFalsy();
      TestFramework.expect(extractor.isValidUrl([])).toBeFalsy();
    });
  });
}

/**
 * Test request URL building
 */
function testBuildRequestUrls() {
  TestFramework.describe("buildRequestUrls", () => {
    TestFramework.it(
      "should build requests for valid URLs and form factors",
      async () => {
        const extractor = new CruxExtractor({
          urls: ["https://example.com", "https://test.com"],
          spreadsheetId: "test-sheet-id",
          apiKey: "test-api-key",
          formFactor: ["PHONE", "DESKTOP"],
        });

        const requests = await extractor.buildRequestUrls();

        TestFramework.expect(requests.length).toBe(4); // 2 URLs × 2 form factors
        TestFramework.expect(requests[0].method).toBe("post");
        TestFramework.expect(requests[0].contentType).toBe("application/json");
      }
    );

    TestFramework.it("should skip invalid URLs", async () => {
      const extractor = new CruxExtractor({
        urls: ["https://example.com", "invalid-url"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE"],
      });

      const requests = await extractor.buildRequestUrls();

      TestFramework.expect(requests.length).toBe(1); // Only valid URL
    });

    TestFramework.it("should skip invalid form factors", async () => {
      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE", "INVALID_FACTOR"],
      });

      const requests = await extractor.buildRequestUrls();

      TestFramework.expect(requests.length).toBe(1); // Only valid form factor
    });

    TestFramework.it(
      "should throw if no valid combinations exist",
      async () => {
        const extractor = new CruxExtractor({
          urls: ["invalid-url"],
          spreadsheetId: "test-sheet-id",
          apiKey: "test-api-key",
        });

        try {
          await extractor.buildRequestUrls();
          TestFramework.expect(true).toBe(false); // Should not reach here
        } catch (error) {
          TestFramework.expect(error.message).toContain(
            "No valid URL/form factor combinations"
          );
        }
      }
    );

    TestFramework.it("should create proper payload structure", async () => {
      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE"],
      });

      const requests = await extractor.buildRequestUrls();
      const payload = JSON.parse(requests[0].payload);

      TestFramework.expect(payload.url).toBe("https://example.com");
      TestFramework.expect(payload.formFactor).toBe("PHONE");
    });
  });
}

/**
 * Test data fetching
 */
function testFetchData() {
  TestFramework.describe("fetchData", () => {
    TestFramework.it("should fetch data successfully", async () => {
      const responses = [
        TestMocks.createDefaultResponse(),
        TestMocks.createDefaultResponse(),
      ];

      TestMocks.setupGlobalMocks({ urlFetchResponses: responses });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE", "DESKTOP"],
      });

      await extractor.buildRequestUrls();
      const data = await extractor.fetchData();

      TestFramework.expect(data.length).toBe(2);
      TestFramework.expect(data[0].record).toBeTruthy();
    });

    TestFramework.it("should skip non-200 responses", async () => {
      const responses = [
        TestMocks.createMockResponse(
          200,
          TestMocks.createDefaultResponse().getContentText()
        ),
        TestMocks.createMockResponse(404, "Not Found"),
      ];

      TestMocks.setupGlobalMocks({ urlFetchResponses: responses });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE", "DESKTOP"],
      });

      await extractor.buildRequestUrls();
      const data = await extractor.fetchData();

      TestFramework.expect(data.length).toBe(1); // Only successful response
    });

    TestFramework.it("should handle JSON parse errors gracefully", async () => {
      const responses = [TestMocks.createMockResponse(200, "invalid-json{")];

      TestMocks.setupGlobalMocks({ urlFetchResponses: responses });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE"],
      });

      await extractor.buildRequestUrls();
      const data = await extractor.fetchData();

      TestFramework.expect(data.length).toBe(0); // Parse error skipped
    });

    TestFramework.it(
      "should throw if buildRequestUrls not called first",
      async () => {
        const extractor = new CruxExtractor({
          urls: ["https://example.com"],
          spreadsheetId: "test-sheet-id",
          apiKey: "test-api-key",
        });

        try {
          await extractor.fetchData();
          TestFramework.expect(true).toBe(false); // Should not reach here
        } catch (error) {
          TestFramework.expect(error.message).toContain(
            "Call buildRequestUrls() first"
          );
        }
      }
    );
  });
}

/**
 * Test data normalization
 */
function testNormalizeData() {
  TestFramework.describe("normalizeData", () => {
    TestFramework.it("should normalize data successfully", async () => {
      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
      });

      extractor.filteredResponse = [
        JSON.parse(TestMocks.createDefaultResponse().getContentText()),
      ];

      const normalized = await extractor.normalizeData();

      TestFramework.expect(normalized.length).toBe(1);
      TestFramework.expect(normalized[0].length).toBe(19); // 19 columns
      TestFramework.expect(normalized[0][0]).toBeTruthy(); // Date
      TestFramework.expect(normalized[0][1]).toBe("PHONE"); // Form factor
      TestFramework.expect(normalized[0][2]).toBe("https://example.com"); // URL
    });

    TestFramework.it("should handle missing metrics gracefully", async () => {
      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
      });

      extractor.filteredResponse = [
        {
          record: {
            key: { url: "https://example.com", formFactor: "PHONE" },
            metrics: {},
          },
        },
      ];

      const normalized = await extractor.normalizeData();

      TestFramework.expect(normalized.length).toBe(1);
      // Check that missing metrics are filled with "-"
      TestFramework.expect(normalized[0][3]).toBe("-"); // LCP Good
    });

    TestFramework.it("should skip invalid responses", async () => {
      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
      });

      extractor.filteredResponse = [
        { invalid: "structure" },
        JSON.parse(TestMocks.createDefaultResponse().getContentText()),
      ];

      const normalized = await extractor.normalizeData();

      TestFramework.expect(normalized.length).toBe(1); // Only valid response
    });

    TestFramework.it("should throw if no filteredResponse exists", async () => {
      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
      });

      try {
        await extractor.normalizeData();
        TestFramework.expect(true).toBe(false); // Should not reach here
      } catch (error) {
        TestFramework.expect(error.message).toContain("Call fetchData() first");
      }
    });

    TestFramework.it(
      "should throw if all responses fail normalization",
      async () => {
        const extractor = new CruxExtractor({
          urls: ["https://example.com"],
          spreadsheetId: "test-sheet-id",
          apiKey: "test-api-key",
        });

        extractor.filteredResponse = [{ invalid: "structure" }];

        try {
          await extractor.normalizeData();
          TestFramework.expect(true).toBe(false); // Should not reach here
        } catch (error) {
          TestFramework.expect(error.message).toContain(
            "All responses failed normalization"
          );
        }
      }
    );
  });
}

/**
 * Test spreadsheet operations
 */
function testAddToSpreadsheet() {
  TestFramework.describe("addToSpreadsheet", () => {
    TestFramework.it("should write data to new sheet", async () => {
      TestMocks.setupGlobalMocks({ sheetExists: false });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
      });

      extractor.normalizedResponse = [Array(19).fill("test-data")];

      await extractor.addToSpreadsheet();

      // If no error thrown, test passes
      TestFramework.expect(true).toBeTruthy();
    });

    TestFramework.it("should write data to existing sheet", async () => {
      TestMocks.setupGlobalMocks({ sheetExists: true });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
      });

      extractor.normalizedResponse = [Array(19).fill("test-data")];

      await extractor.addToSpreadsheet();

      TestFramework.expect(true).toBeTruthy();
    });

    TestFramework.it(
      "should throw if no normalizedResponse exists",
      async () => {
        const extractor = new CruxExtractor({
          urls: ["https://example.com"],
          spreadsheetId: "test-sheet-id",
          apiKey: "test-api-key",
        });

        try {
          await extractor.addToSpreadsheet();
          TestFramework.expect(true).toBe(false); // Should not reach here
        } catch (error) {
          TestFramework.expect(error.message).toContain(
            "Call normalizeData() first"
          );
        }
      }
    );
  });
}

/**
 * Test run method (pipeline orchestration)
 */
function testRun() {
  TestFramework.describe("run", () => {
    TestFramework.it(
      "should execute complete pipeline successfully",
      async () => {
        const responses = [TestMocks.createDefaultResponse()];

        TestMocks.setupGlobalMocks({
          urlFetchResponses: responses,
          sheetExists: false,
        });

        const extractor = new CruxExtractor({
          urls: ["https://example.com"],
          spreadsheetId: "test-sheet-id",
          apiKey: "test-api-key",
          formFactor: ["PHONE"],
        });

        const summary = await extractor.run();

        TestFramework.expect(summary.totalRequests).toBe(1);
        TestFramework.expect(summary.successfulResponses).toBe(1);
        TestFramework.expect(summary.rowsWritten).toBe(1);
        TestFramework.expect(summary.failedRequests).toBe(0);
      }
    );

    TestFramework.it("should return correct failure count", async () => {
      const responses = [
        TestMocks.createDefaultResponse(),
        TestMocks.createMockResponse(404, "Not Found"),
      ];

      TestMocks.setupGlobalMocks({
        urlFetchResponses: responses,
        sheetExists: false,
      });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE", "DESKTOP"],
      });

      const summary = await extractor.run();

      TestFramework.expect(summary.failedRequests).toBe(1);
    });

    TestFramework.it("should include executionId in summary", async () => {
      const responses = [TestMocks.createDefaultResponse()];

      TestMocks.setupGlobalMocks({
        urlFetchResponses: responses,
        sheetExists: false,
      });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE"],
      });

      const summary = await extractor.run();

      TestFramework.expect(summary.executionId).toBeTruthy();
      TestFramework.expect(summary.executionId).toContain("exec_");
    });
  });
}

/**
 * Test getExecutionHistorySheet method
 */
function testGetExecutionHistorySheet() {
  TestFramework.describe("getExecutionHistorySheet", () => {
    TestFramework.it("should create history sheet if it doesn't exist", () => {
      TestMocks.setupGlobalMocks({ sheetExists: false });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
      });

      const historySheet = extractor.getExecutionHistorySheet();

      TestFramework.expect(historySheet).toBeTruthy();
      TestFramework.expect(historySheet.getName()).toBe("executionHistory");
    });

    TestFramework.it(
      "should return existing history sheet if it exists",
      () => {
        TestMocks.setupGlobalMocks({ sheetExists: true });

        const extractor = new CruxExtractor({
          urls: ["https://example.com"],
          spreadsheetId: "test-sheet-id",
          apiKey: "test-api-key",
        });

        const historySheet = extractor.getExecutionHistorySheet();

        TestFramework.expect(historySheet).toBeTruthy();
        TestFramework.expect(historySheet.getName()).toBe("cruxData");
      }
    );

    TestFramework.it(
      "should set correct headers when creating new sheet",
      () => {
        TestMocks.setupGlobalMocks({ sheetExists: false });

        const extractor = new CruxExtractor({
          urls: ["https://example.com"],
          spreadsheetId: "test-sheet-id",
          apiKey: "test-api-key",
        });

        const historySheet = extractor.getExecutionHistorySheet();
        const headers = historySheet.getRange(1, 1, 1, 8).getValues()[0];

        TestFramework.expect(headers[0]).toBe("Execution ID");
        TestFramework.expect(headers[1]).toBe("Timestamp");
        TestFramework.expect(headers[2]).toBe("URL");
        TestFramework.expect(headers[3]).toBe("Form Factor");
        TestFramework.expect(headers[4]).toBe("Status");
        TestFramework.expect(headers[5]).toBe("Response Code");
        TestFramework.expect(headers[6]).toBe("Error Message");
        TestFramework.expect(headers[7]).toBe("Normalized");
      }
    );
  });
}

/**
 * Test logExecutionHistory method
 */
function testLogExecutionHistory() {
  TestFramework.describe("logExecutionHistory", () => {
    TestFramework.it("should log execution records successfully", () => {
      TestMocks.setupGlobalMocks({ sheetExists: false });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
      });

      const records = [
        {
          url: "https://example.com",
          formFactor: "PHONE",
          status: "SUCCESS",
          responseCode: 200,
          errorMessage: "-",
          normalized: "YES",
        },
        {
          url: "https://example.com",
          formFactor: "DESKTOP",
          status: "FAILED",
          responseCode: 404,
          errorMessage: "Not Found",
          normalized: "NO",
        },
      ];

      extractor.logExecutionHistory("exec_123456_789", records);

      const historySheet = extractor.getExecutionHistorySheet();
      const lastRow = historySheet.getLastRow();

      TestFramework.expect(lastRow).toBe(3); // Header + 2 records
    });

    TestFramework.it("should handle empty records array", () => {
      TestMocks.setupGlobalMocks({ sheetExists: false });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
      });

      extractor.logExecutionHistory("exec_123456_789", []);

      const historySheet = extractor.getExecutionHistorySheet();
      const lastRow = historySheet.getLastRow();

      TestFramework.expect(lastRow).toBe(1); // Only header
    });

    TestFramework.it("should handle records with missing fields", () => {
      TestMocks.setupGlobalMocks({ sheetExists: false });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
      });

      const records = [
        {
          url: "https://example.com",
          formFactor: "PHONE",
          status: "SUCCESS",
        },
      ];

      extractor.logExecutionHistory("exec_123456_789", records);

      const historySheet = extractor.getExecutionHistorySheet();
      const data = historySheet.getRange(2, 1, 1, 8).getValues()[0];

      TestFramework.expect(data[0]).toBe("exec_123456_789"); // Execution ID
      TestFramework.expect(data[2]).toBe("https://example.com"); // URL
      TestFramework.expect(data[5]).toBe("-"); // Response code should default to "-"
      TestFramework.expect(data[6]).toBe("-"); // Error message should default to "-"
      TestFramework.expect(data[7]).toBe("NO"); // Normalized should default to "NO"
    });

    TestFramework.it("should append to existing history records", () => {
      TestMocks.setupGlobalMocks({ sheetExists: true });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
      });

      const records1 = [
        {
          url: "https://example1.com",
          formFactor: "PHONE",
          status: "SUCCESS",
          responseCode: 200,
          errorMessage: "-",
          normalized: "YES",
        },
      ];

      extractor.logExecutionHistory("exec_111111_111", records1);

      const records2 = [
        {
          url: "https://example2.com",
          formFactor: "DESKTOP",
          status: "SUCCESS",
          responseCode: 200,
          errorMessage: "-",
          normalized: "YES",
        },
      ];

      extractor.logExecutionHistory("exec_222222_222", records2);

      const historySheet = extractor.getExecutionHistorySheet();
      const lastRow = historySheet.getLastRow();

      TestFramework.expect(lastRow).toBe(3); // Header + 2 records
    });
  });
}
