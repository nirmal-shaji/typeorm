import "../../../utils/test-setup"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../../utils/test-utils"
import { expect } from "chai"
import type { DataSource } from "../../../../src"
import { ExampleEntity } from "./entity/ExampleEntity"

describe("query builder > sql string literal", () => {
    let dataSources: DataSource[]
    before(async () => {
        dataSources = await createTestingConnections({
            entities: [ExampleEntity],
            enabledDrivers: ["better-sqlite3"],
        })
    })
    beforeEach(() => reloadTestingDatabases(dataSources))
    after(() => closeTestingConnections(dataSources))

    // A single-quoted string literal may legitimately contain a word that also
    // happens to be an entity property/column name (here "id"). The identifier
    // replacement must not rewrite such a word into an escaped identifier, which
    // would corrupt the literal and produce invalid SQL. See issue #11579.
    it("should not rewrite entity property names that appear inside a string literal (delete)", () => {
        for (const dataSource of dataSources) {
            const sql = dataSource
                .createQueryBuilder()
                .delete()
                .from(ExampleEntity)
                .where("name = 'this id will delete.'")
                .getSql()

            expect(sql).to.contain("'this id will delete.'")
            expect(sql).to.not.contain('this "id" will delete.')
        }
    })

    it("should not rewrite entity property names that appear inside a string literal (update)", () => {
        for (const dataSource of dataSources) {
            const sql = dataSource
                .createQueryBuilder()
                .update(ExampleEntity)
                .set({ name: "changed" })
                .where("name = 'keep this id intact'")
                .getSql()

            expect(sql).to.contain("'keep this id intact'")
            expect(sql).to.not.contain('keep this "id" intact')
        }
    })

    // A query comment may itself contain an apostrophe (e.g.
    // `.comment("it's a note")`). The literal masking must recognize comments,
    // otherwise the stray apostrophe pairs with a later real literal and masks
    // the SQL in between - leaving entity property names unmapped. See #11579.
    it("should not corrupt SQL when a query comment contains an apostrophe", () => {
        for (const dataSource of dataSources) {
            const sql = dataSource
                .createQueryBuilder(ExampleEntity, "example")
                .select("example.id", "id")
                .where("example.name = 'x'")
                .comment("it's a note")
                .getSql()

            expect(sql).to.contain("/* it's a note */")
            expect(sql).to.contain("'x'")
            // The property must still be mapped to its escaped column; if the
            // comment's apostrophe masked the WHERE clause it would be left as
            // the raw `example.name`.
            expect(sql).to.contain('"example"."name"')
            expect(sql).to.not.contain("= example.name")
        }
    })
})
