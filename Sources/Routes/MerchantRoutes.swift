import Vapor

func registerMerchantRoutes(_ app: Application) {
    app.get("merchants") { request async throws -> [Merchant] in
        try await MerchantService(database: request.db).list()
    }
}
