/**
 * End-to-end integration tests for CruxExtractor
 *
 * Run with: runE2ETests()
 */

function runE2ETests() {
  TestFramework.reset();
  TestMocks.setupGlobalMocks();

  testCompleteDataExtractionFlow();
  testErrorRecovery();
  testPartialFailures();
  testEdgeCases();

  TestMocks.cleanupGlobalMocks();
  return TestFramework.printResults();
}

/**
 * Test complete data extraction flow
 */
function testCompleteDataExtractionFlow() {
  TestFramework.describe("E2E: Complete Data Extraction Flow", () => {
    TestFramework.it("should extract data for multiple URLs and form factors", async () => {
      const responses = [
        TestMocks.createDefaultResponse(),
        TestMocks.createDefaultResponse(),
        TestMocks.createDefaultResponse(),
        TestMocks.createDefaultResponse(),
      ];

      TestMocks.setupGlobalMocks({
        urlFetchResponses: responses,
        sheetExists: false,
      });

      const extractor = new CruxExtractor({
        urls: ["https://example.com", "https://test.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE", "DESKTOP"],
      });

      const summary = await extractor.run();

      TestFramework.expect(summary.totalRequests).toBe(4);
      TestFramework.expect(summary.successfulResponses).toBe(4);
      TestFramework.expect(summary.rowsWritten).toBe(4);
      TestFramework.expect(summary.failedRequests).toBe(0);
    });

    TestFramework.it("should write correct data format to sheet", async () => {
      const response = TestMocks.createDefaultResponse();
      TestMocks.setupGlobalMocks({
        urlFetchResponses: [response],
        sheetExists: false,
      });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE"],
      });

      await extractor.run();

      const normalized = extractor.normalizedResponse;
      TestFramework.expect(normalized.length).toBe(1);
      TestFramework.expect(normalized[0].length).toBe(31);

      // Verify data structure
      TestFramework.expect(typeof normalized[0][0]).toBe("string"); // Date
      TestFramework.expect(typeof normalized[0][1]).toBe("string"); // FormFactor
      TestFramework.expect(typeof normalized[0][2]).toBe("string"); // URL
      // Remaining are metric values (numbers or "-")
    });

    TestFramework.it("should append to existing sheet", async () => {
      const response = TestMocks.createDefaultResponse();
      TestMocks.setupGlobalMocks({
        urlFetchResponses: [response],
        sheetExists: true,
      });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE"],
      });

      const summary = await extractor.run();

      TestFramework.expect(summary.rowsWritten).toBe(1);
    });
  });
}

/**
 * Test error recovery scenarios
 */
function testErrorRecovery() {
  TestFramework.describe("E2E: Error Recovery", () => {
    TestFramework.it("should handle all failed API requests", async () => {
      const responses = [
        TestMocks.createMockResponse(500, "Server Error"),
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

      try {
        await extractor.run();
        TestFramework.expect(true).toBe(false); // Should throw
      } catch (error) {
        TestFramework.expect(error.message).toContain(
          "No successful API responses"
        );
      }
    });

    TestFramework.it("should handle malformed API responses", async () => {
      const responses = [
        TestMocks.createMockResponse(200, "invalid-json"),
      ];

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

      try {
        await extractor.run();
        TestFramework.expect(true).toBe(false); // Should throw
      } catch (error) {
        TestFramework.expect(error.message).toContain(
          "No successful API responses"
        );
      }
    });

    TestFramework.it("should handle invalid response structure", async () => {
      const responses = [
        TestMocks.createMockResponse(200, { invalid: "structure" }),
      ];

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

      try {
        await extractor.run();
        TestFramework.expect(true).toBe(false); // Should throw
      } catch (error) {
        TestFramework.expect(error.message).toContain("failed normalization");
      }
    });
  });
}

/**
 * Test partial failure scenarios
 */
function testPartialFailures() {
  TestFramework.describe("E2E: Partial Failures", () => {
    TestFramework.it("should continue with valid URLs when some are invalid", async () => {
      const responses = [
        TestMocks.createDefaultResponse(),
      ];

      TestMocks.setupGlobalMocks({
        urlFetchResponses: responses,
        sheetExists: false,
      });

      const extractor = new CruxExtractor({
        urls: ["https://example.com", "invalid-url"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE"],
      });

      const summary = await extractor.run();

      TestFramework.expect(summary.totalRequests).toBe(1); // Only valid URL
      TestFramework.expect(summary.successfulResponses).toBe(1);
    });

    TestFramework.it("should continue when some API requests fail", async () => {
      const responses = [
        TestMocks.createDefaultResponse(),
        TestMocks.createMockResponse(500, "Server Error"),
        TestMocks.createDefaultResponse(),
      ];

      TestMocks.setupGlobalMocks({
        urlFetchResponses: responses,
        sheetExists: false,
      });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE", "DESKTOP", "ALL_FORM_FACTORS"],
      });

      const summary = await extractor.run();

      TestFramework.expect(summary.totalRequests).toBe(3);
      TestFramework.expect(summary.successfulResponses).toBe(2);
      TestFramework.expect(summary.failedRequests).toBe(1);
    });

    TestFramework.it("should continue when some responses fail normalization", async () => {
      const goodResponse = JSON.parse(
        TestMocks.createDefaultResponse().getContentText()
      );
      const badResponse = { invalid: "structure" };

      TestMocks.setupGlobalMocks({
        urlFetchResponses: [
          TestMocks.createMockResponse(200, goodResponse),
          TestMocks.createMockResponse(200, badResponse),
        ],
        sheetExists: false,
      });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE", "DESKTOP"],
      });

      const summary = await extractor.run();

      TestFramework.expect(summary.successfulResponses).toBe(2);
      TestFramework.expect(summary.rowsWritten).toBe(1); // Only good response normalized
    });
  });
}

/**
 * Test edge cases
 */
function testEdgeCases() {
  TestFramework.describe("E2E: Edge Cases", () => {
    TestFramework.it("should handle single URL with all form factors", async () => {
      const responses = [
        TestMocks.createDefaultResponse(),
        TestMocks.createDefaultResponse(),
        TestMocks.createDefaultResponse(),
      ];

      TestMocks.setupGlobalMocks({
        urlFetchResponses: responses,
        sheetExists: false,
      });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE", "DESKTOP", "ALL_FORM_FACTORS"],
      });

      const summary = await extractor.run();

      TestFramework.expect(summary.totalRequests).toBe(3);
      TestFramework.expect(summary.rowsWritten).toBe(3);
    });

    TestFramework.it("should handle URLs with trailing slashes", async () => {
      const response = TestMocks.createDefaultResponse();
      TestMocks.setupGlobalMocks({
        urlFetchResponses: [response],
        sheetExists: false,
      });

      const extractor = new CruxExtractor({
        urls: ["https://example.com/"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE"],
      });

      const summary = await extractor.run();

      TestFramework.expect(summary.totalRequests).toBe(1);
    });

    TestFramework.it("should handle URLs with query parameters", async () => {
      const response = TestMocks.createDefaultResponse();
      TestMocks.setupGlobalMocks({
        urlFetchResponses: [response],
        sheetExists: false,
      });

      const extractor = new CruxExtractor({
        urls: ["https://example.com?param=value"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE"],
      });

      const summary = await extractor.run();

      TestFramework.expect(summary.totalRequests).toBe(1);
    });

    TestFramework.it("should handle response with missing optional metrics", async () => {
      const partialResponse = {
        record: {
          key: { url: "https://example.com", formFactor: "PHONE" },
          metrics: {
            largest_contentful_paint: {
              histogram: [{ density: 0.5 }, { density: 0.3 }, { density: 0.2 }],
              percentiles: { p75: 2500 },
            },
            // Missing FID, CLS, FCP
          },
        },
      };

      TestMocks.setupGlobalMocks({
        urlFetchResponses: [
          TestMocks.createMockResponse(200, partialResponse),
        ],
        sheetExists: false,
      });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE"],
      });

      const summary = await extractor.run();

      TestFramework.expect(summary.rowsWritten).toBe(1);

      // Verify missing metrics are filled with "-"
      const row = extractor.normalizedResponse[0];
      TestFramework.expect(row[7]).toBe("-"); // FID Good should be "-"
    });

    TestFramework.it("should handle empty histogram arrays", async () => {
      const emptyHistResponse = {
        record: {
          key: { url: "https://example.com", formFactor: "PHONE" },
          metrics: {
            largest_contentful_paint: {
              histogram: [],
              percentiles: {},
            },
            first_input_delay: {
              histogram: [],
              percentiles: {},
            },
            cumulative_layout_shift: {
              histogram: [],
              percentiles: {},
            },
            first_contentful_paint: {
              histogram: [],
              percentiles: {},
            },
          },
        },
      };

      TestMocks.setupGlobalMocks({
        urlFetchResponses: [
          TestMocks.createMockResponse(200, emptyHistResponse),
        ],
        sheetExists: false,
      });

      const extractor = new CruxExtractor({
        urls: ["https://example.com"],
        spreadsheetId: "test-sheet-id",
        apiKey: "test-api-key",
        formFactor: ["PHONE"],
      });

      const summary = await extractor.run();

      TestFramework.expect(summary.rowsWritten).toBe(1);

      // Verify all metric values are "-"
      const row = extractor.normalizedResponse[0];
      TestFramework.expect(row[3]).toBe("-"); // LCP Good
      TestFramework.expect(row[6]).toBe("-"); // LCP p75
    });
  });
}
