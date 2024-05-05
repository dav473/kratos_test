"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { inventoryFormSchema } from "@/schemas/forms";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { FormError } from "@/components/form-error";
import { FormSuccess } from "@/components/form-success";
import { Input } from "@/components/ui/input";

import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multiselect";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  canadianProvinces,
  cannabisProduct,
  certifications,
  edibles,
  extractTypes,
  extractsInhalation,
  extractsMain,
  extractsOral,
  industrialHemp,
  plants,
  seeds,
  strains,
  testingLabs,
  topicals,
} from "@/constants/inventory-form-constants";
import { S3_BUCKET } from "@/constants/s3-constants";
import { storeObjectWithExpiry } from "@/data/cache";
import { cn, generateRandomString } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ReloadIcon } from "@radix-ui/react-icons";

type InventoryFormValues = z.infer<typeof inventoryFormSchema>;

export function InventoryForm() {
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  const [uploadedCOA, setUploadedCOA] = useState<boolean>(false);
  const [scrapedCOA, setScrapedCOA] = useState<boolean>(false);
  const searchParams = useSearchParams();
  const [companyName, setCompanyName] = useState<string | undefined>(
    searchParams.get("companyName") || undefined,
  );
  const [province, setProvince] = useState<string | undefined>(
    searchParams.get("province") || undefined,
  );
  const companyId = searchParams.get("companyId") || undefined;
  const logo = searchParams.get("logo") || "nordstern";
  const router = useRouter();

  const defaultValues = {
    coa: false,
    seller_name: companyName,
    company_id: companyId,
    origin_province: province,
  };

  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const cannabisExtract = form.watch("cannabis_class");
  const productType = form.watch("product_type");
  const coaAvailable = form.watch("coa");

  // reset conditional fields
  useEffect(() => {
    if (productType !== "Flower") {
      form.setValue("indoor_outdoor", undefined);
      form.setValue("trim", undefined);
      form.setValue("dry", undefined);
    }
    if (!cannabisExtract?.includes("Extracts")) {
      form.setValue("production_date", undefined);
      form.setValue("harvest_date", undefined);
      form.setValue("extraction_method", undefined);
    } else if (cannabisExtract?.includes("Extracts")) {
      form.setValue("harvest_date", undefined);
    }
  }, [productType, cannabisExtract]);

  async function onSubmit(data: InventoryFormValues) {
    setIsPending(true)
    if (
      data?.coa &&
      (data?.testing_facility === "A&L Canada Laboratories Inc." ||
        data?.testing_facility === "High North Inc.")
    ) {
      try {
        const form = new FormData();
        const modelId = testingLabs.find(
          (lab) => lab.name === data?.testing_facility,
        )?.modelId;
        // why are we setting form here?
        form.set("file", data.coa[0]);
        form.set("modelID", modelId as string);
        form.set("lot_number", data.lot_number as string);
        form.set("bucketName", S3_BUCKET);
        form.set("fileName", "/coa/" + data.lot_number + ".pdf",);
        console.log("started upload of coa");

        // Step 1: upload COA to S3 and send to scraper
        console.log("fileData:", data.coa[0]);
        const [_, scraperResponse] = await Promise.all([
          fetch("/api/upload", {
            method: "POST",
            body: form,
          }).then(_ => setUploadedCOA(true)),
          fetch("/api/labs", {
            method: "POST",
            body: form,
          }).then(res => {
            setScrapedCOA(true)
            return res
          }),
        ])

        const scraperData = await scraperResponse.json();
        console.log("completed upload of coa to s3");
        // Step 2: store the location of the COA in redis, alongside the testing_facility for model selection
        const pid = generateRandomString();
        await storeObjectWithExpiry(pid, {
          coa: "/coa/" + data.lot_number + ".pdf",
          lab: modelId,
          scraperData: scraperData,
        })
          .then((result) => console.log("Result:", result))
          .catch((error) => console.error("Error:", error));

        // Step 3: forward the user to the coa scraper, with query string for decoding
        router.push("/labs?pid=" + pid);

      } catch (error) {
        console.log(error);
      }
    }
    console.log(data);
    toast.success("Form submitted successfully!");
  }

  return (
    <Card>
      <CardHeader>
        <img
          className="mb-5"
          src={logo === "nordstern" ? "/nordstern.png" : "/355.png"}
          width="200"
          height="200"
          alt="Logo"
        />
        <CardTitle>Inventory Request Form</CardTitle>
        <CardDescription>Fill out details of your inventory</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <Form {...form}>
          <form
            encType="multipart/form-data"
            className="space-y-5"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="lot_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lot Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isPending}
                      min="0"
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="coa"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>COA Available</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value !== false}
                        onCheckedChange={(checked) => {
                          form.setValue("coa", checked ? true : false);
                          if (!checked) {
                            form.setValue(
                              "certificate_of_analysis_date",
                              undefined,
                            );
                            form.setValue("testing_facility", undefined);
                          }
                        }}
                      />
                    </FormControl>
                  </div>
                  {field.value !== false && (
                    <FormControl>
                      <Input
                        type="file"
                        disabled={isPending}
                        onChange={(e) => {
                          if (e.target.files) {
                            form.setValue("coa", e.target.files);
                          }
                        }}
                      />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            {coaAvailable !== false && (
              <div className="flex justify-between gap-5">
                <FormField
                  control={form.control}
                  name="testing_facility"
                  render={({ field }) => (
                    <FormItem className="flex w-full flex-col">
                      <FormLabel>Testing Facility / Lab</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                " justify-between",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value
                                ? field.value
                                : "Select facility/lab"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className=" p-0">
                          <Command>
                            <CommandList>
                              <CommandInput />
                              <CommandEmpty>None found.</CommandEmpty>
                              <CommandGroup>
                                {testingLabs.map((lab, index) => (
                                  <CommandItem
                                    value={lab.name}
                                    key={index}
                                    onSelect={() => {
                                      form.setValue(
                                        "testing_facility",
                                        lab.name,
                                      );
                                    }}
                                  >
                                    {lab.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                      {field.value === "Other" && (
                        <>
                          <Label>Input lab name... </Label>
                          <FormControl>
                            <Input
                              onBlur={field.onChange}
                              disabled={isPending}
                            />
                          </FormControl>
                        </>
                      )}
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="certificate_of_analysis_date"
                  render={({ field }) => (
                    <FormItem className="flex w-full flex-col">
                      <FormLabel>Certificate of Analysis Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value as any}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            <Separator />
            <div className="flex justify-between gap-5">
              <FormField
                control={form.control}
                name="seller_name"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Seller Name</FormLabel>
                    <FormControl>
                      <Input
                        className={companyName ? "bg-yellow-100" : ""}
                        {...field}
                        disabled={isPending}
                        onChange={(e) => {
                          field.onChange(e);
                          setCompanyName(undefined);
                        }}
                      />
                    </FormControl>
                    {companyName && (
                      <p className="bottom-0 left-0 text-xs text-yellow-600">
                        *Pre-filled form data
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="origin_province"
                render={({ field }) => (
                  <FormItem className="w-2/3">
                    <FormLabel>Origin Province</FormLabel>
                    <Select
                      onValueChange={(e) => {
                        field.onChange(e);
                        setProvince(undefined);
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger
                          className={province ? "bg-yellow-100" : ""}
                        >
                          <SelectValue placeholder="Select a province" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {canadianProvinces.map((province, index) => (
                          <SelectItem value={province.value} key={index}>
                            {province.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {province && (
                      <p className="bottom-0 left-0 text-xs text-yellow-600">
                        *Pre-filled form data
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-between gap-5">
              <FormField
                control={form.control}
                name="strain_name"
                render={({ field }) => (
                  <FormItem className="flex w-full flex-col">
                    <FormLabel>Strain Name</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              " justify-between",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            {field.value ? field.value : "Select strain"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="p-1">
                        <Command className="w-full">
                          <CommandList>
                            <CommandInput placeholder="Search strain..." />
                            <CommandEmpty>No strain found.</CommandEmpty>
                            <CommandGroup>
                              {strains.map((strain, index) => (
                                <CommandItem
                                  value={strain}
                                  key={index}
                                  onSelect={() => {
                                    form.setValue("strain_name", strain);
                                  }}
                                >
                                  {strain}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                    {field.value === "Other" && (
                      <>
                        <Label>Input strain name... </Label>
                        <FormControl>
                          <Input onBlur={field.onChange} disabled={isPending} />
                        </FormControl>
                      </>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="thc"
                render={({ field }) => (
                  <FormItem className="flex w-1/4 flex-col">
                    <FormLabel>THC%</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        disabled={isPending}
                        step="0.01"
                        min="0"
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            form.setValue("thc", Number(value));
                          }
                        }}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cbd"
                render={({ field }) => (
                  <FormItem className="flex w-1/4 flex-col">
                    <FormLabel>CBD%</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        disabled={isPending}
                        step="0.01"
                        min="0"
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            form.setValue("cbd", Number(value));
                          }
                        }}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-between gap-5">
              <div className="flex w-full flex-col gap-3">
                <FormField
                  control={form.control}
                  name="cannabis_class"
                  render={({ field }) => (
                    <FormItem className="flex w-full flex-col">
                      <FormLabel>Cannabis/Product Class</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "justify-between",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value
                                ? form.getValues("product_type")
                                : "Select class"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="p-0">
                          <Command className="rounded-lg border shadow-md">
                            <CommandInput placeholder="Search..." />
                            <CommandList>
                              <CommandEmpty>No results found.</CommandEmpty>
                              <CommandGroup heading="Dried Cannabis">
                                {cannabisProduct.map((c) => (
                                  <CommandItem
                                    value={`${c.product} - Dried Cannabis`}
                                    key={`${c.product} - Dried`}
                                    onSelect={() => {
                                      form.setValue(
                                        "cannabis_class",
                                        "Dried Cannabis",
                                      );
                                      form.setValue("product_type", c.product);
                                    }}
                                  >
                                    {c.product}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              <CommandSeparator />
                              <CommandGroup heading="Fresh Cannabis">
                                {cannabisProduct.map((c) => (
                                  <CommandItem
                                    value={`${c.product} - Fresh Cannabis`}
                                    key={`${c.product} - Fresh`}
                                    onSelect={() => {
                                      form.setValue(
                                        "cannabis_class",
                                        "Fresh Cannabis",
                                      );
                                      form.setValue("product_type", c.product);
                                    }}
                                  >
                                    {c.product}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              <CommandSeparator />
                              <CommandGroup heading="Frozen Cannabis">
                                {cannabisProduct.map((c) => (
                                  <CommandItem
                                    value={`${c.product} - Frozen Cannabis`}
                                    key={`${c.product} - Frozen`}
                                    onSelect={() => {
                                      form.setValue(
                                        "cannabis_class",
                                        "Frozen Cannabis",
                                      );
                                      form.setValue("product_type", c.product);
                                    }}
                                  >
                                    {c.product}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              <CommandSeparator />
                              <CommandGroup heading="Industrial Hemp">
                                {industrialHemp.map((c) => (
                                  <CommandItem
                                    value={`${c.product} - Industrial Hemp`}
                                    key={c.product}
                                    onSelect={() => {
                                      form.setValue(
                                        "cannabis_class",
                                        "Industrial Hemp",
                                      );
                                      form.setValue("product_type", c.product);
                                    }}
                                  >
                                    {c.product}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              <CommandSeparator />
                              <CommandGroup heading="Seeds">
                                {seeds.map((c) => (
                                  <CommandItem
                                    value={`${c.product} - Seeds`}
                                    key={c.product}
                                    onSelect={() => {
                                      form.setValue("cannabis_class", "Seeds");
                                      form.setValue("product_type", c.product);
                                    }}
                                  >
                                    {c.product}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              <CommandSeparator />
                              <CommandGroup heading="Plants">
                                {plants.map((c) => (
                                  <CommandItem
                                    value={`${c.product} - Plants`}
                                    key={c.product}
                                    onSelect={() => {
                                      form.setValue("cannabis_class", "Plants");
                                      form.setValue("product_type", c.product);
                                    }}
                                  >
                                    {c.product}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              <CommandSeparator />
                              <CommandGroup heading="Extracts">
                                {extractsMain.map((c) => (
                                  <CommandItem
                                    value={`${c.product} - Extracts`}
                                    key={c.product}
                                    onSelect={() => {
                                      form.setValue(
                                        "cannabis_class",
                                        "Extracts - Main",
                                      );
                                      form.setValue("product_type", c.product);
                                    }}
                                  >
                                    {c.product}
                                  </CommandItem>
                                ))}
                                {extractsInhalation.map((c) => (
                                  <CommandItem
                                    value={`${c.product} - Extracts`}
                                    key={c.product}
                                    onSelect={() => {
                                      form.setValue(
                                        "cannabis_class",
                                        "Extracts - Inhalation",
                                      );
                                      form.setValue("product_type", c.product);
                                    }}
                                  >
                                    {c.product}
                                  </CommandItem>
                                ))}
                                {extractsOral.map((c) => (
                                  <CommandItem
                                    value={`${c.product} - Extracts`}
                                    key={c.product}
                                    onSelect={() => {
                                      form.setValue(
                                        "cannabis_class",
                                        "Extracts - Oral",
                                      );
                                      form.setValue("product_type", c.product);
                                    }}
                                  >
                                    {c.product}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              <CommandSeparator />
                              <CommandGroup heading="Edibles">
                                {edibles.map((c) => (
                                  <CommandItem
                                    value={`${c.product} - Edibles`}
                                    key={c.product}
                                    onSelect={() => {
                                      form.setValue(
                                        "cannabis_class",
                                        "Edibles",
                                      );
                                      form.setValue("product_type", c.product);
                                    }}
                                  >
                                    {c.product}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              <CommandSeparator />
                              <CommandGroup heading="Topicals">
                                {topicals.map((c) => (
                                  <CommandItem
                                    value={`${c.product} - Topicals`}
                                    key={c.product}
                                    onSelect={() => {
                                      form.setValue(
                                        "cannabis_class",
                                        "Topicals",
                                      );
                                      form.setValue("product_type", c.product);
                                    }}
                                  >
                                    {c.product}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {cannabisExtract?.includes("Extracts") && (
                  <>
                    <FormField
                      control={form.control}
                      name="extraction_method"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Extract Methods</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "justify-between",
                                    !field.value && "text-muted-foreground",
                                  )}
                                >
                                  {field.value
                                    ? field.value
                                    : "Select extract method"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className=" p-0">
                              <Command>
                                <CommandInput />
                                <CommandEmpty>
                                  No extract type found.
                                </CommandEmpty>
                                <CommandGroup>
                                  {extractTypes.map((type, index) => (
                                    <CommandItem
                                      value={type.value}
                                      key={index}
                                      onSelect={() => {
                                        form.setValue(
                                          "extraction_method",
                                          type.value,
                                        );
                                      }}
                                    >
                                      {type.value}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
              <FormField
                control={form.control}
                name="terpenes"
                render={({ field }) => (
                  <FormItem className="flex w-1/4 flex-col">
                    <FormLabel>Total Terps%</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        disabled={isPending}
                        step="0.01"
                        min="0"
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            form.setValue("terpenes", Number(value));
                          }
                        }}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="moisture"
                render={({ field }) => (
                  <FormItem className="flex w-1/4 flex-col">
                    <FormLabel>Moisture%</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        disabled={isPending}
                        step="0.01"
                        min="0"
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            form.setValue("moisture", Number(value));
                          }
                        }}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-between gap-5">
              <FormField
                control={form.control}
                name="certifications"
                render={({ field }) => (
                  <FormItem className="flex w-full flex-col">
                    <FormLabel>Certifications</FormLabel>
                    <FormControl>
                      <MultiSelect
                        onChange={(values) => {
                          field.onChange(values.map(({ value }) => value));
                        }}
                        frameworks={certifications}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {cannabisExtract?.includes("Extracts") ? (
                <FormField
                  control={form.control}
                  name="production_date"
                  render={({ field }) => (
                    <FormItem className="flex w-2/3 flex-col">
                      <FormLabel>Production Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value as any}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="harvest_date"
                  render={({ field }) => (
                    <FormItem className="flex w-2/3 flex-col">
                      <FormLabel>Harvest Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value as any}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            <div>
              <FormField
                control={form.control}
                name="photo_upload"
                render={({ field }) => (
                  <FormItem className="flex w-1/2 flex-col">
                    <FormLabel>Photo Upload</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="file"
                        disabled={isPending}
                        multiple
                        name="file[]"
                        onChange={(e) => {
                          if (e.target.files) {
                            form.setValue("photo_upload", e.target.files);
                          }
                        }}
                        value={undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="lineage"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-5">
                  <FormLabel>Lineage:</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="!mt-0 flex flex-row items-center gap-3"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="sativa" />
                        </FormControl>
                        <FormLabel className="font-normal">Sativa</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="indica" />
                        </FormControl>
                        <FormLabel className="font-normal">Indica</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="hybrid" />
                        </FormControl>
                        <FormLabel className="font-normal">Hybrid</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {productType === "Flower" && (
              <div className="flex justify-start gap-10">
                <FormField
                  control={form.control}
                  name="indoor_outdoor"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Indoor/Outdoor</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="indoor" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Indoor
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="outdoor" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Outdoor
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="trim"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Trim Method</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="hand" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Hand Trimmed
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="machine" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Machine Trimmed
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="no" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Not Trimmed
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dry"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Drying Method</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="rack" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Rack Dried
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="hang" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Hang Dried
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            <Separator />
            <div className="flex justify-between gap-5">
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem className="flex w-full flex-col">
                    <FormLabel>Cost Per Gram (CAD)</FormLabel>
                    <FormControl className="flex w-full flex-row items-center">
                      <Input
                        {...field}
                        type="number"
                        disabled={isPending}
                        step="0.01"
                        min="0"
                        onBlur={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            form.setValue("cost", value.toFixed(2));
                          }
                        }}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="volume"
                render={({ field }) => (
                  <FormItem className="flex w-full flex-col">
                    <FormLabel>Volume Available in Grams</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number" // Keep as text to allow formatted display
                        disabled={isPending}
                        min="0"
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            form.setValue("volume", Number(value));
                          }
                        }}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expected_availability_date"
                render={({ field }) => (
                  <FormItem className="flex w-full flex-col">
                    <FormLabel>Expected Availability Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value as any}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Separator />
            <FormField
              control={form.control}
              name="general_notes"
              render={({ field }) => (
                <FormItem className="flex w-full flex-col">
                  <FormLabel>General Notes</FormLabel>
                  <FormControl>
                    <textarea
                      className={cn(
                        "flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                      {...field}
                      disabled={isPending}
                      rows={5}
                    ></textarea>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Separator />
            <FormError message={error} />
            <FormSuccess message={success} />
            <div className="flex flex-col gap-4 pt-12">
              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        I certify the information submitted is accurate.
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <Button disabled={isPending} type="submit">
                {isPending
                  ? <>{uploadedCOA
                    ? (scrapedCOA ? "Finished scraping COA!" :
                      "Completed uploading of COA, scraping data off COA...")
                    : "Uploading COA..."}<ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> </> : 'Submit Form'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default InventoryForm;
