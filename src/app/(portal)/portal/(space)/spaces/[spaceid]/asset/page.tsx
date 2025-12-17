"use client"
import { SpaceItem } from "@/app/api/space/get"
import { Empty } from "@/components/Empty"
import { FilterItem, SelectionList } from "@/components/SelectionList"
import TextInput from "@/components/TextInput"
import { UploadButton } from "@/components/UploadButton"
import { usePhrases } from "@/lib/lang"
import { AssetInternalViewModel } from "@/models/asset"
import { useAssets, useAssetFolders } from "@/networking/hooks/asset"
import { useFolders } from "@/networking/hooks/folder"
import { useSpaces } from "@/networking/hooks/spaces"
import { useProfile } from "@/networking/hooks/user"
import { Box, Center, Flex, Heading, HStack, Spinner, Tag, useToast, VStack } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import dayjs from "dayjs"
import { useRouter } from "next/navigation"
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Search } from "react-feather"
import { FixedSizeList } from "react-window"

// Constants
const VIRTUAL_ROW_HEIGHT = 80

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(handler)
        }
    }, [value, delay])

    return debouncedValue
}

// Isolated search input component to prevent parent re-renders
const SearchInput = memo(({ value, onChange, placeholder, t }: { value: string; onChange: (value: string) => void; placeholder: string; t: (key: string) => string }) => {
    return (
        <HStack justifyContent={"flex-start"} gap={3}>
            <Search></Search>
            <Box w="300px">
                <TextInput value={value} placeholder={placeholder} bg="#fff" focus={true} onChange={onChange} onSubmit={onChange}></TextInput>
            </Box>
        </HStack>
    )
})

SearchInput.displayName = "SearchInput"

// Type definitions for virtualized list
interface VirtualRowData {
    items: AssetInternalViewModel[]
    onNavigate: (assetId: string) => void
    t: (key: string) => string
}

interface VirtualRowProps {
    index: number
    style: React.CSSProperties
    data: VirtualRowData
}

// Virtualized row component for react-window
const VirtualRow = memo(({ index, style, data }: VirtualRowProps) => {
    const { items, onNavigate, t } = data
    const item = items[index]

    return (
        <Box
            role="row"
            style={style}
            display="flex"
            alignItems="center"
            borderBottom="1px solid"
            borderColor="gray.100"
            _hover={{ backgroundColor: "#fff", cursor: "pointer" }}
            onClick={() => onNavigate(item.assetId)}
            px={4}
        >
            <Box role="cell" flex="1" fontWeight="600" py={3}>
                <Box mb={1}>{item.name}</Box>
                <Tag size="sm" colorScheme="gray">
                    {item.type.toUpperCase()}
                </Tag>
            </Box>

            <Box role="cell" w="200px" py={3}>
                <Box>{dayjs(item.modifiedDate).format("YYYY-MM-DD")}</Box>
                <Box fontSize="12px">{item.modifiedUserName}</Box>
            </Box>

            <Box role="cell" w="150px" py={3}>
                {item.status === "disabled" ? (
                    <Tag colorScheme="red" ml={5}>
                        {t("asset_home_list_table_status_disabled")}
                    </Tag>
                ) : (
                    <Tag colorScheme="green" ml={5}>
                        {t("asset_home_list_table_status_enabled")}
                    </Tag>
                )}
            </Box>
        </Box>
    )
})

VirtualRow.displayName = "VirtualRow"

export default function Home({ params }: { params: { spaceid: string } }) {
    const router = useRouter()
    const { t } = usePhrases()
    const [mode, setMode] = useState<"list" | "loading">("loading")
    const [listHeight, setListHeight] = useState(600)
    const listContainerRef = useRef<HTMLDivElement>(null)
    const { profile } = useProfile()
    const { spaces, isLoading: isSpacesLoading } = useSpaces({ enabled: true })
    const [space, setSpace] = useState<SpaceItem>()
    const { items: allItems, isLoading: isContentLoading } = useAssets(params.spaceid, {})
    const [filterFolders, setFilterFolders] = useState<FilterItem[]>([])
    const [filterTypes, setFilterTypes] = useState<FilterItem[]>([])
    const queryClient = useQueryClient()
    const [filterFolder, setFilterFolder] = useState<string>("")
    const [filterType, setFilterType] = useState<string>("")
    const [filterStatus, setFilterStatus] = useState<string>("")
    const [filterSearchInput, setFilterSearchInput] = useState<string>("")
    const filterSearch = useDebounce(filterSearchInput, 300)
    const { folders, isLoading: isFoldersLoading } = useAssetFolders(params.spaceid, {})
    const toast = useToast()

    // Memoize the search input change handler
    const handleSearchChange = useCallback((value: string) => {
        setFilterSearchInput(value)
    }, [])

    // Measure and update list height
    useEffect(() => {
        const updateHeight = () => {
            if (listContainerRef.current) {
                const height = listContainerRef.current.clientHeight
                if (height > 0) {
                    setListHeight(height)
                }
            }
        }

        updateHeight()

        if (!listContainerRef.current) return

        const observer = new ResizeObserver(updateHeight)
        observer.observe(listContainerRef.current)

        return () => observer.disconnect()
    }, [mode])

    // Memoize filtered items to prevent recalculation on every render
    const filteredItems = useMemo(() => {
        if (!allItems) return []

        return allItems.filter((item) => {
            if (filterFolder) {
                if (item.assetFolderId !== filterFolder) return false
            }

            if (filterType) {
                if (item.type !== filterType) return false
            }
            if (filterStatus) {
                if (item.status !== filterStatus) return false
            }
            if (filterSearch) {
                let searchMatch = false
                if (item.name.toLocaleLowerCase().includes(filterSearch.toLocaleLowerCase())) searchMatch = true
                if (item.modifiedUserName.toLocaleLowerCase().includes(filterSearch.toLocaleLowerCase())) searchMatch = true
                if (item.folderName) {
                    if (item.folderName.toLocaleLowerCase().includes(filterSearch.toLocaleLowerCase())) searchMatch = true
                }
                if (!searchMatch) return false
            }

            return true
        })
    }, [allItems, filterFolder, filterType, filterStatus, filterSearch])

    // Memoize navigation callback
    const handleNavigate = useCallback(
        (assetId: string) => {
            router.push(`/portal/spaces/${params.spaceid}/asset/${assetId}`)
        },
        [router, params.spaceid]
    )

    function extractFilters() {
        if (!allItems) return
        let folders: FilterItem[] = []
        let types: FilterItem[] = []

        allItems.forEach((item) => {
            if (item.assetFolderId) {
                const folder = folders.find((f) => f.id === item.assetFolderId)
                if (!folder) {
                    folders.push({ id: item.assetFolderId, name: item.folderName || t("asset_home_unknown_folder") })
                }
            }

            const type = types.find((c) => c.id === item.type)
            if (!type) {
                types.push({ id: item.type, name: item.type.toUpperCase() })
            }
        })
        setFilterFolders(folders)
        setFilterTypes(types)
    }

    useEffect(() => {
        extractFilters()
    }, [allItems])

    useEffect(() => {
        if (!profile) return
        if (!allItems) return
        if (!folders) return
        if (!spaces) return

        const space = spaces.find((s) => s.spaceId === params.spaceid)
        setSpace(space)

        setMode("list")
    }, [profile, allItems, folders, spaces])

    return (
        <>
            {mode == "loading" && (
                <Center h="100vh" w="100%">
                    <Spinner size="xl" colorScheme="blue"></Spinner>
                </Center>
            )}

            {mode == "list" && (
                <>
                    <Flex height="calc(100vh - 52px)" flexDir={"row"} maxW="1400px" overflow="hidden">
                        <Flex bg="#fff" width="250px" p={5} flexDirection="column" overflowY="auto" maxHeight="100%">
                            <VStack spacing={10} alignItems={"flex-start"} w="100%">
                                {space!.role === "owner" || profile?.role === "admin" ? (
                                    <SelectionList
                                        subject={t("asset_home_list_filter_folder_subject")}
                                        items={filterFolders}
                                        selectedItemId={filterFolder}
                                        anyText={t("asset_home_list_filter_folder_anytext")}
                                        onClick={setFilterFolder}
                                        settingsTooltip={t("asset_home_list_filter_folder_tooltip")}
                                        onSettings={() => {
                                            router.push(`/portal/spaces/${params.spaceid}/asset/folder`)
                                        }}
                                    ></SelectionList>
                                ) : (
                                    <SelectionList
                                        minElements={1}
                                        subject={t("asset_home_list_filter_folder_subject")}
                                        items={filterFolders}
                                        selectedItemId={filterFolder}
                                        anyText={t("asset_home_list_filter_folder_anytext")}
                                        onClick={setFilterFolder}
                                    ></SelectionList>
                                )}

                                <SelectionList
                                    subject={t("asset_home_list_filter_type_subject")}
                                    items={filterTypes}
                                    selectedItemId={filterType}
                                    onClick={setFilterType}
                                    anyText={t("asset_home_list_filter_type_anytext")}
                                ></SelectionList>

                                <SelectionList
                                    subject={t("asset_home_list_filter_status_subject")}
                                    items={[
                                        { id: "enabled", name: t("asset_home_list_filter_status_enabled") },
                                        { id: "disabled", name: t("asset_home_list_filter_status_disabled") },
                                    ]}
                                    selectedItemId={filterStatus}
                                    onClick={setFilterStatus}
                                    anyText={t("asset_home_list_filter_status_anytext")}
                                ></SelectionList>
                            </VStack>
                        </Flex>
                        <Flex flex={1} flexDirection="column" overflow="hidden" pt={10} pl={10}>
                            <HStack w="100%" alignItems={"center"} gap={10}>
                                <Heading>{t("asset_home_list_heading")}</Heading>
                                <Box flex={1}>
                                    <SearchInput value={filterSearchInput} onChange={handleSearchChange} placeholder={t("asset_home_list_serach_placeholder")} t={t} />
                                </Box>

                                <UploadButton
                                    text={t("asset_home_list_create_button")}
                                    spaceId={params.spaceid}
                                    onUploaded={(asset) => {
                                        queryClient.invalidateQueries([["asset"]])
                                        router.push(`/portal/spaces/${params.spaceid}/asset/${asset.assetId}`)
                                    }}
                                ></UploadButton>
                            </HStack>
                            <Box pt={5} flex={1} display="flex" flexDirection="column" minHeight={0}>
                                {filteredItems.length > 0 ? (
                                    <Box role="table" aria-label={t("asset_home_list_heading")} flex={1} display="flex" flexDirection="column" minHeight={0}>
                                        {/* Header row */}
                                        <Box
                                            role="row"
                                            display="flex"
                                            px={4}
                                            py={3}
                                            borderBottom="2px solid"
                                            borderColor="gray.200"
                                            fontWeight="bold"
                                            fontSize="sm"
                                            textTransform="uppercase"
                                            letterSpacing="wider"
                                            color="gray.600"
                                            flexShrink={0}
                                        >
                                            <Box role="columnheader" flex="1">
                                                {t("asset_home_list_table_heading_name")}
                                            </Box>
                                            <Box role="columnheader" w="200px">
                                                {t("asset_home_list_table_heading_modified")}
                                            </Box>
                                            <Box role="columnheader" w="150px">
                                                {t("asset_home_list_table_heading_status")}
                                            </Box>
                                        </Box>

                                        {/* Virtualized list - takes remaining space */}
                                        <Box role="rowgroup" flex={1} minHeight={0} ref={listContainerRef}>
                                            <FixedSizeList
                                                height={listHeight}
                                                itemCount={filteredItems.length}
                                                itemSize={VIRTUAL_ROW_HEIGHT}
                                                width="100%"
                                                itemData={{ items: filteredItems, onNavigate: handleNavigate, t }}
                                            >
                                                {VirtualRow}
                                            </FixedSizeList>
                                        </Box>
                                    </Box>
                                ) : (
                                    <Empty message={t("asset_home_list_table_noitems")}></Empty>
                                )}
                            </Box>
                        </Flex>
                    </Flex>
                </>
            )}
        </>
    )
}
