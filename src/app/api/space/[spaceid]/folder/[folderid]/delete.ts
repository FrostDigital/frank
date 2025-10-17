import { returnJSON, returnNotFound, withRequestBody, withSpaceRole, withUser } from "@/lib/apiUtils"
import { collections } from "@/lib/db"
import { generateRouteInfoParams } from "@/lib/docs";
import { z } from "zod"

export async function DELETE(req: Request, context: { params: { spaceid: string; folderid: string } }) {
    return await withUser(req, "any", async (user) => {
        return await withSpaceRole(user, context.params.spaceid, "any", async (role) => {
            const folder = await collections.folder.findOne({ spaceId: context.params.spaceid, folderId: context.params.folderid })
            if (!folder) {
                return returnNotFound("Folder not found")
            }

            // Get cascade parameter from query string
            const url = new URL(req.url)
            const cascadeParam = url.searchParams.get("cascade")
            const cascade = cascadeParam === "true"

            // Delete the folder
            collections.folder.deleteMany({ spaceId: context.params.spaceid, folderId: context.params.folderid })

            // Handle content in the folder based on cascade parameter
            if (cascade) {
                // CASCADE mode: Delete all content in the folder
                await collections.content.deleteMany({
                    spaceId: context.params.spaceid,
                    folderId: context.params.folderid,
                })
            } else {
                // DETACH mode: Remove folder reference from content
                collections.content.updateMany(
                    {
                        spaceId: context.params.spaceid,
                        folderId: context.params.folderid,
                    },
                    { $unset: { folderId: true } }
                )
            }

            return returnJSON<{}>({}, z.object({}))
        })
    })
}

export const DELETE_DOC: generateRouteInfoParams = {
    tags: ["content folder"],
    path: "/space/:spaceid/folder/:folderid",
    method: "delete",
    summary: "Delete content folder",
    requiresAuth: "user-jwt-token",
    params: ["spaceid", "folderid"],
    responseSchema: z.object({}),
    responseDescription: "Folder successfully deleted",
    errors: {
        ERROR_NOTFOUND: "Folder not found"
    }
}