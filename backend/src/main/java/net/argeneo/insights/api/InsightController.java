package net.argeneo.insights.api;

import jakarta.validation.Valid;
import net.argeneo.insights.InsightService;
import net.argeneo.insights.api.dto.InsightDtos.AdCopyRequest;
import net.argeneo.insights.api.dto.InsightDtos.AdCopyResponse;
import net.argeneo.insights.api.dto.InsightDtos.DayAnalysisRequest;
import net.argeneo.insights.api.dto.InsightDtos.DayAnalysisResponse;
import net.argeneo.insights.api.dto.InsightDtos.DaysAnalysisRequest;
import net.argeneo.insights.api.dto.InsightDtos.DaysAnalysisResponse;
import net.argeneo.insights.api.dto.InsightDtos.PricingRequest;
import net.argeneo.insights.api.dto.InsightDtos.PricingResponse;
import net.argeneo.insights.api.dto.InsightDtos.SocialPostRequest;
import net.argeneo.insights.api.dto.InsightDtos.SocialPostResponse;
import net.argeneo.insights.api.dto.InsightDtos.TrendRequest;
import net.argeneo.insights.api.dto.InsightDtos.TrendResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Avis de tendance (Gemini) à partir du contexte des prochains jours. */
@RestController
@RequestMapping("/api/insights")
public class InsightController {

    private final InsightService service;

    public InsightController(InsightService service) {
        this.service = service;
    }

    @PostMapping("/trend")
    public TrendResponse trend(@Valid @RequestBody TrendRequest request) {
        return service.trend(request);
    }

    @PostMapping("/day")
    public DayAnalysisResponse day(@Valid @RequestBody DayAnalysisRequest request) {
        return service.dayAnalysis(request);
    }

    @PostMapping("/days")
    public DaysAnalysisResponse days(@Valid @RequestBody DaysAnalysisRequest request) {
        return service.daysAnalysis(request);
    }

    @PostMapping("/pricing")
    public PricingResponse pricing(@Valid @RequestBody PricingRequest request) {
        return service.pricingAdvice(request);
    }

    @PostMapping("/ad")
    public AdCopyResponse ad(@Valid @RequestBody AdCopyRequest request) {
        return service.adCopy(request);
    }

    @PostMapping("/social")
    public SocialPostResponse social(@Valid @RequestBody SocialPostRequest request) {
        return service.socialPost(request);
    }
}
